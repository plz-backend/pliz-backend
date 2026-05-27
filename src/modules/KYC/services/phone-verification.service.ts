import prisma from '../../../config/database';
import axios from 'axios';
import logger from '../../../config/logger';
import { maskPhoneForLog } from '../../../utils/sanitize-log';
import { PhoneOtpChannel } from '../types/kyc.interface';

const OTP_EXPIRY_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
/** WhatsApp OTP create can be slow to acknowledge; SMS is usually faster. */
const SENDCHAMP_CREATE_TIMEOUT_MS: Record<PhoneOtpChannel, number> = {
  sms: 25_000,
  whatsapp: 60_000,
};
const SENDCHAMP_CONFIRM_TIMEOUT_MS = 30_000;

/** SendChamp expects E.164 digits without "+" (e.g. 2348012345678). */
function formatPhoneForSendChamp(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, '');
  if (!digits) {
    throw new Error('Invalid phone number on profile. Update it in Personal Information.');
  }
  return digits;
}

function mapSendChampErrorMessage(raw: unknown): string {
  const message =
    typeof raw === 'string'
      ? raw
      : typeof raw === 'object' && raw !== null && 'message' in raw
        ? String((raw as { message: unknown }).message)
        : '';
  const normalized = message.trim().toLowerCase();

  if (
    normalized.includes('timeout') ||
    normalized.includes('econnaborted') ||
    normalized.includes('etimedout')
  ) {
    return 'Sending your code is taking longer than usual. Please wait a moment, then tap Resend OTP if you do not receive it.';
  }

  if (
    normalized.includes('low balance') ||
    normalized.includes('fund your wallet') ||
    normalized.includes('insufficient') ||
    normalized.includes('wallet') ||
    normalized.includes('sender') ||
    normalized.includes('api key') ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden')
  ) {
    return 'We could not send your verification code right now. Please try again later.';
  }

  if (message.trim()) {
    return message;
  }

  return 'Failed to send OTP. Please try again.';
}

function isAxiosTimeout(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  return (
    error.code === 'ECONNABORTED' ||
    error.message.toLowerCase().includes('timeout')
  );
}

function normalizeOtpChannel(channel?: string | null): PhoneOtpChannel {
  return channel === 'whatsapp' ? 'whatsapp' : 'sms';
}

function channelDeliveryLabel(channel: PhoneOtpChannel): string {
  return channel === 'whatsapp' ? 'WhatsApp' : 'SMS';
}

export class PhoneVerificationService {
  static async sendPhoneOTP(
    userId: string,
    channel: PhoneOtpChannel = 'sms'
  ): Promise<{ phoneNumber: string; channel: PhoneOtpChannel }> {
    try {
      const profile = await prisma.userProfile.findUnique({
        where: { userId },
        select: { phoneNumber: true },
      });

      if (!profile?.phoneNumber) {
        throw new Error(
          'Phone number not found. Please complete your profile first.'
        );
      }

      const existing = await prisma.userVerification.findUnique({
        where: { userId },
        select: { phoneVerified: true },
      });

      if (existing?.phoneVerified) {
        throw new Error('Phone number is already verified.');
      }

      await this.issuePhoneOtp(userId, profile.phoneNumber, channel);

      logger.info('Phone OTP sent', {
        userId,
        phone: maskPhoneForLog(profile.phoneNumber),
        channel,
      });

      return {
        phoneNumber: this.maskPhoneNumber(profile.phoneNumber),
        channel,
      };
    } catch (error: any) {
      logger.error('Failed to send phone OTP', {
        error: error.message,
        userId,
        channel,
      });
      throw error;
    }
  }

  static async resendPhoneOTP(
    userId: string,
    channel: PhoneOtpChannel = 'sms'
  ): Promise<{ phoneNumber: string; channel: PhoneOtpChannel }> {
    try {
      const [profile, verification] = await Promise.all([
        prisma.userProfile.findUnique({
          where: { userId },
          select: { phoneNumber: true },
        }),
        prisma.userVerification.findUnique({
          where: { userId },
          select: {
            phoneVerified: true,
            phoneOtpSentAt: true,
          },
        }),
      ]);

      if (!profile?.phoneNumber) {
        throw new Error(
          'Phone number not found. Please complete your profile first.'
        );
      }
      if (verification?.phoneVerified) {
        throw new Error('Phone number is already verified.');
      }

      if (verification?.phoneOtpSentAt) {
        const secondsSinceSent =
          (Date.now() - new Date(verification.phoneOtpSentAt).getTime()) / 1000;

        if (secondsSinceSent < OTP_RESEND_COOLDOWN_SECONDS) {
          const secondsRemaining = Math.ceil(
            OTP_RESEND_COOLDOWN_SECONDS - secondsSinceSent
          );
          throw new Error(
            `Please wait ${secondsRemaining} seconds before requesting a new OTP.`
          );
        }
      }

      await this.issuePhoneOtp(userId, profile.phoneNumber, channel);

      logger.info('Phone OTP resent', { userId, channel });

      return {
        phoneNumber: this.maskPhoneNumber(profile.phoneNumber),
        channel,
      };
    } catch (error: any) {
      logger.error('Failed to resend phone OTP', {
        error: error.message,
        userId,
        channel,
      });
      throw error;
    }
  }

  static async verifyPhoneOTP(userId: string, otp: string): Promise<void> {
    try {
      const verification = await prisma.userVerification.findUnique({
        where: { userId },
        select: {
          phoneOtp: true,
          phoneOtpSentAt: true,
          phoneVerified: true,
        },
      });

      if (!verification) {
        throw new Error('Please request an OTP first.');
      }
      if (verification.phoneVerified) {
        throw new Error('Phone number is already verified.');
      }
      if (!verification.phoneOtp || !verification.phoneOtpSentAt) {
        throw new Error('No OTP found. Please request a new OTP.');
      }

      const sentAt = new Date(verification.phoneOtpSentAt);
      const expiresAt = new Date(sentAt);
      expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

      if (new Date() > expiresAt) {
        throw new Error('OTP has expired. Please request a new one.');
      }

      await this.confirmSendChampOtp(verification.phoneOtp, otp);

      await prisma.userVerification.update({
        where: { userId },
        data: {
          phoneVerified: true,
          phoneVerifiedAt: new Date(),
          phoneOtp: null,
          phoneOtpSentAt: null,
        },
      });

      await prisma.notification.create({
        data: {
          userId,
          type: 'phone_verified',
          title: '📱 Phone Number Verified!',
          body: 'Your phone number has been verified. Now verify your identity to start creating begs on Plz.',
          data: {},
        },
      });

      logger.info('Phone OTP verified', { userId });
    } catch (error: any) {
      logger.error('Phone OTP verification failed', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  static async getPhoneVerificationStatus(userId: string): Promise<{
    phoneVerified: boolean;
    phoneNumber: string | null;
    maskedPhoneNumber: string | null;
    canResend: boolean;
    secondsUntilResend: number;
    lastChannel: PhoneOtpChannel | null;
  }> {
    const [profile, verification] = await Promise.all([
      prisma.userProfile.findUnique({
        where: { userId },
        select: { phoneNumber: true },
      }),
      prisma.userVerification.findUnique({
        where: { userId },
        select: {
          phoneVerified: true,
          phoneOtpSentAt: true,
          phoneVerificationChannel: true,
        },
      }),
    ]);

    let canResend = true;
    let secondsUntilResend = 0;

    if (verification?.phoneOtpSentAt) {
      const secondsSinceSent =
        (Date.now() - new Date(verification.phoneOtpSentAt).getTime()) / 1000;

      if (secondsSinceSent < OTP_RESEND_COOLDOWN_SECONDS) {
        canResend = false;
        secondsUntilResend = Math.ceil(
          OTP_RESEND_COOLDOWN_SECONDS - secondsSinceSent
        );
      }
    }

    return {
      phoneVerified: verification?.phoneVerified || false,
      phoneNumber: profile?.phoneNumber || null,
      maskedPhoneNumber: profile?.phoneNumber
        ? this.maskPhoneNumber(profile.phoneNumber)
        : null,
      canResend,
      secondsUntilResend,
      lastChannel: verification?.phoneVerificationChannel
        ? normalizeOtpChannel(verification.phoneVerificationChannel)
        : null,
    };
  }

  private static async issuePhoneOtp(
    userId: string,
    phoneNumber: string,
    channel: PhoneOtpChannel
  ): Promise<void> {
    const reference = await this.createSendChampOtp(phoneNumber, channel);

    await prisma.userVerification.upsert({
      where: { userId },
      create: {
        userId,
        phoneOtp: reference,
        phoneOtpSentAt: new Date(),
        phoneVerificationChannel: channel,
        status: 'pending',
        attemptCount: 0,
      },
      update: {
        phoneOtp: reference,
        phoneOtpSentAt: new Date(),
        phoneVerificationChannel: channel,
      },
    });
  }

  private static sendChampHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.SENDCHAMP_API_KEY!}`,
      Accept: 'application/json',
    };
  }

  private static resolveSender(channel: PhoneOtpChannel): string {
    if (channel === 'whatsapp') {
      const sender = process.env.SENDCHAMP_WHATSAPP_SENDER?.trim();
      if (!sender) {
        throw new Error(
          'WhatsApp verification is not available right now. Please try SMS instead.'
        );
      }
      return sender;
    }

    return process.env.SENDCHAMP_SMS_SENDER?.trim() || 'Sendchamp';
  }

  /**
   * POST /api/v1/verification/create
   * @see https://sendchamp.readme.io/reference/send-otp-api
   */
  private static async createSendChampOtp(
    phoneNumber: string,
    channel: PhoneOtpChannel
  ): Promise<string> {
    const mobile = formatPhoneForSendChamp(phoneNumber);

    if (!process.env.SENDCHAMP_API_KEY?.trim()) {
      throw new Error(
        'We could not send your verification code right now. Please try again later.'
      );
    }

    const sender = this.resolveSender(channel);

    try {
      const response = await axios.post(
        'https://api.sendchamp.com/api/v1/verification/create',
        {
          channel,
          sender,
          token_length: 6,
          token_type: 'numeric',
          expiration_time: OTP_EXPIRY_MINUTES,
          customer_mobile_number: mobile,
          meta_data: {},
        },
        {
          headers: this.sendChampHeaders(),
          timeout: SENDCHAMP_CREATE_TIMEOUT_MS[channel],
        }
      );

      if (
        response.data?.status !== 'success' ||
        !response.data?.data?.reference
      ) {
        throw new Error(response.data?.message || 'Failed to send OTP');
      }

      const data = response.data.data as { reference?: string; status?: string };
      const sendStatus = String(data.status ?? '').toLowerCase();
      if (sendStatus === 'failed' || sendStatus === 'error') {
        throw new Error('Failed to send OTP. Please try again.');
      }

      logger.info('OTP sent via SendChamp verification API', {
        phone: maskPhoneForLog(mobile),
        reference: data.reference,
        sender,
        channel,
      });

      return data.reference as string;
    } catch (error: any) {
      const timedOut = isAxiosTimeout(error);
      const log = timedOut ? logger.warn.bind(logger) : logger.error.bind(logger);
      log('SendChamp verification create failed', {
        error: error.message,
        response: error.response?.data,
        phone: maskPhoneForLog(mobile),
        channel,
        timedOut,
      });
      throw new Error(
        mapSendChampErrorMessage(error.response?.data?.message ?? error.message)
      );
    }
  }

  /**
   * POST /api/v1/verification/confirm
   * @see https://sendchamp.readme.io/reference/confirm-otp-api
   */
  private static async confirmSendChampOtp(
    reference: string,
    otp: string
  ): Promise<void> {
    if (!process.env.SENDCHAMP_API_KEY?.trim()) {
      throw new Error(
        'We could not verify your code right now. Please try again later.'
      );
    }

    try {
      const response = await axios.post(
        'https://api.sendchamp.com/api/v1/verification/confirm',
        {
          verification_reference: reference,
          verification_code: otp,
        },
        {
          headers: this.sendChampHeaders(),
          timeout: SENDCHAMP_CONFIRM_TIMEOUT_MS,
        }
      );

      if (response.data?.status !== 'success') {
        throw new Error(
          response.data?.message || 'Invalid OTP. Please check and try again.'
        );
      }

      logger.info('OTP confirmed via SendChamp', { reference });
    } catch (error: any) {
      logger.error('SendChamp verification confirm failed', {
        error: error.message,
        reference,
      });
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error('Invalid OTP. Please check and try again.');
    }
  }

  static maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length < 7) return phoneNumber;
    const start = phoneNumber.slice(0, 7);
    const end = phoneNumber.slice(-3);
    return `${start}****${end}`;
  }

  static deliveryLabelForChannel(channel: PhoneOtpChannel): string {
    return channelDeliveryLabel(channel);
  }
}

import prisma from '../../../config/database';
import axios from 'axios';
import logger from '../../../config/logger';
import { maskPhoneForLog } from '../../../utils/sanitize-log';

const OTP_EXPIRY_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

export type OTPChannel = 'sms' | 'whatsapp';

/** SendChamp expects E.164 digits without "+" (e.g. 2348012345678). */
function formatPhoneForSendChamp(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, '');
  if (!digits) {
    throw new Error('Invalid phone number on profile. Update it in Personal Information.');
  }
  return digits;
}

function mapSendChampErrorMessage(raw: unknown, channel: OTPChannel): string {
  const message =
    typeof raw === 'string'
      ? raw
      : typeof raw === 'object' && raw !== null && 'message' in raw
        ? String((raw as { message: unknown }).message)
        : '';
  const normalized = message.trim().toLowerCase();

  if (/channel/i.test(message) && /oneof/i.test(message)) {
    return 'We could not send your verification code right now. Please try again later.';
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

  return `Failed to send OTP via ${channel}. Please try again.`;
}

export class PhoneVerificationService {

  // ============================================
  // SEND PHONE OTP
  // User picks channel: sms | whatsapp
  // ============================================
  static async sendPhoneOTP(
    userId: string,
    channel: OTPChannel = 'sms'
  ): Promise<{
    channel: OTPChannel;
    phoneNumber: string;
  }> {
    try {
      // Validate channel
      if (!['sms', 'whatsapp'].includes(channel)) {
        throw new Error('Invalid channel. Must be sms or whatsapp.');
      }

      // Check WhatsApp is configured before allowing
      if (
        channel === 'whatsapp' &&
        !process.env.SENDCHAMP_WHATSAPP_SENDER
      ) {
        throw new Error(
          'WhatsApp verification is not available at the moment. Please use SMS.'
        );
      }

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

      // Send OTP via chosen channel
      const reference = await this.sendViaSendChamp(profile.phoneNumber, channel);

      // Store reference + sent time + channel
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

      logger.info('Phone OTP sent', {
        userId,
        channel,
        phone: maskPhoneForLog(profile.phoneNumber),
      });

      return {
        channel,
        phoneNumber: this.maskPhoneNumber(profile.phoneNumber),
      };
    } catch (error: any) {
      logger.error('Failed to send phone OTP', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  // ============================================
  // RESEND PHONE OTP
  // User can switch channel on resend
  // e.g. tried SMS → switch to WhatsApp
  // ============================================
  static async resendPhoneOTP(
    userId: string,
    channel?: OTPChannel
  ): Promise<{
    channel: OTPChannel;
    phoneNumber: string;
  }> {
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
            phoneVerificationChannel: true,
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

      // Enforce cooldown
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

      // Use new channel if provided — otherwise use same channel as before
      const selectedChannel: OTPChannel =
        channel ||
        (verification?.phoneVerificationChannel as OTPChannel) ||
        'sms';

      // Validate channel
      if (!['sms', 'whatsapp'].includes(selectedChannel)) {
        throw new Error('Invalid channel. Must be sms or whatsapp.');
      }

      // Check WhatsApp is configured
      if (
        selectedChannel === 'whatsapp' &&
        !process.env.SENDCHAMP_WHATSAPP_SENDER
      ) {
        throw new Error(
          'WhatsApp verification is not available at the moment. Please use SMS.'
        );
      }

      // Send OTP via chosen channel
      const reference = await this.sendViaSendChamp(profile.phoneNumber, selectedChannel);

      await prisma.userVerification.upsert({
        where: { userId },
        create: {
          userId,
          phoneOtp: reference,
          phoneOtpSentAt: new Date(),
          phoneVerificationChannel: selectedChannel,
          status: 'pending',
          attemptCount: 0,
        },
        update: {
          phoneOtp: reference,
          phoneOtpSentAt: new Date(),
          phoneVerificationChannel: selectedChannel,
        },
      });

      logger.info('Phone OTP resent', { userId, channel: selectedChannel });

      return {
        channel: selectedChannel,
        phoneNumber: this.maskPhoneNumber(profile.phoneNumber),
      };
    } catch (error: any) {
      logger.error('Failed to resend phone OTP', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  // ============================================
  // VERIFY PHONE OTP
  // ============================================
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

      // Check expiry — 10 minutes from sent time
      const sentAt = new Date(verification.phoneOtpSentAt);
      const expiresAt = new Date(sentAt);
      expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

      if (new Date() > expiresAt) {
        throw new Error('OTP has expired. Please request a new one.');
      }

      // Confirm via SendChamp
      await this.confirmOTPWithSendChamp(verification.phoneOtp, otp);

      // Mark as verified
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

  // ============================================
  // GET AVAILABLE CHANNELS
  // Frontend uses this to show options
  // ============================================
  static getAvailableChannels(): {
    channels: { value: OTPChannel; label: string; available: boolean }[];
  } {
    return {
      channels: [
        {
          value: 'sms',
          label: 'SMS',
          available: true,            // SMS always available
        },
        {
          value: 'whatsapp',
          label: 'WhatsApp',
          available: !!process.env.SENDCHAMP_WHATSAPP_SENDER, // only if configured
        },
      ],
    };
  }

  // ============================================
  // GET PHONE VERIFICATION STATUS
  // ============================================
  static async getPhoneVerificationStatus(userId: string): Promise<{
    phoneVerified: boolean;
    phoneNumber: string | null;
    maskedPhoneNumber: string | null;
    channel: string | null;
    canResend: boolean;
    secondsUntilResend: number;
    availableChannels: {
      value: OTPChannel;
      label: string;
      available: boolean;
    }[];
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
      channel: verification?.phoneVerificationChannel || null,
      canResend,
      secondsUntilResend,
      availableChannels: this.getAvailableChannels().channels,
    };
  }

  // ============================================
  // SENDCHAMP — SEND OTP
  // POST /api/v1/verification/create
  // ============================================
  private static async sendViaSendChamp(
    phoneNumber: string,
    channel: OTPChannel
  ): Promise<string> {
    const mobile = formatPhoneForSendChamp(phoneNumber);

    // Dev mode — skip actual API call
    if (process.env.NODE_ENV === 'development') {
      logger.info('DEV MODE — OTP not sent', {
        phone: maskPhoneForLog(mobile),
        channel,
      });
      return `DEV_REF_${Date.now()}`;
    }

    try {
      const sender =
        channel === 'whatsapp'
          ? process.env.SENDCHAMP_WHATSAPP_SENDER!
          : process.env.SENDCHAMP_SMS_SENDER || 'Plz';

      const response = await axios.post(
        'https://api.sendchamp.com/api/v1/verification/create',
        {
          // SendChamp API expects lowercase: sms | whatsapp | voice | email
          channel,
          sender,
          token_length: 6,
          token_type: 'numeric',
          expiration_time: OTP_EXPIRY_MINUTES,
          customer_mobile_number: mobile,
          success_message: `Your Plz verification code is {otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share this code with anyone.`,
          failure_message: 'OTP verification failed. Please try again.',
          meta_data: {},
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.SENDCHAMP_API_KEY}`,
            Accept: 'application/json',
          },
          timeout: 15000,
        }
      );

      if (
        response.data?.status !== 'success' ||
        !response.data?.data?.reference
      ) {
        throw new Error(
          response.data?.message || `Failed to send OTP via ${channel}`
        );
      }

      logger.info(`OTP sent via ${channel}`, { phone: maskPhoneForLog(mobile) });

      return response.data.data.reference as string;
    } catch (error: any) {
      logger.error(`SendChamp ${channel} send failed`, {
        error: error.message,
        response: error.response?.data,
        phone: maskPhoneForLog(mobile),
      });
      throw new Error(
        mapSendChampErrorMessage(error.response?.data?.message ?? error.message, channel)
      );
    }
  }

  // ============================================
  // SENDCHAMP — CONFIRM OTP
  // POST /api/v1/verification/confirm
  // ============================================
  private static async confirmOTPWithSendChamp(
    reference: string,
    otp: string
  ): Promise<void> {
    // Dev mode — accept any 6-digit OTP
    if (process.env.NODE_ENV === 'development') {
      logger.info('DEV MODE — OTP confirmation skipped');
      if (!/^\d{6}$/.test(otp)) {
        throw new Error('Invalid OTP. Must be 6 digits.');
      }
      return;
    }

    try {
      const response = await axios.post(
        'https://api.sendchamp.com/api/v1/verification/confirm',
        {
          verification_reference: reference,
          verification_otp: otp,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.SENDCHAMP_API_KEY}`,
            Accept: 'application/json',
          },
          timeout: 15000,
        }
      );

      if (response.data?.status !== 'success') {
        throw new Error(
          response.data?.message || 'Invalid OTP. Please check and try again.'
        );
      }

      logger.info('OTP confirmed via SendChamp');
    } catch (error: any) {
      logger.error('SendChamp OTP confirmation failed', {
        error: error.message,
      });
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error('Invalid OTP. Please check and try again.');
    }
  }

  // ============================================
  // MASK PHONE NUMBER
  // e.g. +2348012345678 → +234801****678
  // ============================================
  static maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length < 7) return phoneNumber;
    const start = phoneNumber.slice(0, 7);
    const end = phoneNumber.slice(-3);
    return `${start}****${end}`;
  }
}

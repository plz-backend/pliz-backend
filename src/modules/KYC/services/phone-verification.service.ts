import crypto from 'crypto';
import prisma from '../../../config/database';
import axios from 'axios';
import logger from '../../../config/logger';
import { maskPhoneForLog } from '../../../utils/sanitize-log';
import { CacheService } from '../../auth/services/cacheService';

const OTP_EXPIRY_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const OTP_EXPIRY_SECONDS = OTP_EXPIRY_MINUTES * 60;
const PHONE_OTP_MARKER = 'SMS';

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

  return 'Failed to send SMS. Please try again.';
}

export class PhoneVerificationService {
  static async sendPhoneOTP(userId: string): Promise<{ phoneNumber: string }> {
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

      await this.sendSmsOtp(userId, profile.phoneNumber);

      await prisma.userVerification.upsert({
        where: { userId },
        create: {
          userId,
          phoneOtp: PHONE_OTP_MARKER,
          phoneOtpSentAt: new Date(),
          phoneVerificationChannel: 'sms',
          status: 'pending',
          attemptCount: 0,
        },
        update: {
          phoneOtp: PHONE_OTP_MARKER,
          phoneOtpSentAt: new Date(),
          phoneVerificationChannel: 'sms',
        },
      });

      logger.info('Phone OTP sent', {
        userId,
        phone: maskPhoneForLog(profile.phoneNumber),
      });

      return {
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

  static async resendPhoneOTP(userId: string): Promise<{ phoneNumber: string }> {
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

      await this.sendSmsOtp(userId, profile.phoneNumber);

      await prisma.userVerification.upsert({
        where: { userId },
        create: {
          userId,
          phoneOtp: PHONE_OTP_MARKER,
          phoneOtpSentAt: new Date(),
          phoneVerificationChannel: 'sms',
          status: 'pending',
          attemptCount: 0,
        },
        update: {
          phoneOtp: PHONE_OTP_MARKER,
          phoneOtpSentAt: new Date(),
          phoneVerificationChannel: 'sms',
        },
      });

      logger.info('Phone OTP resent', { userId });

      return {
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

      if (this.shouldSkipSendChamp()) {
        if (!/^\d{6}$/.test(otp)) {
          throw new Error('Invalid OTP. Must be 6 digits.');
        }
      } else {
        const valid = await CacheService.verifyPhoneOtpCode(userId, otp);
        if (!valid) {
          throw new Error('Invalid OTP. Please check and try again.');
        }
      }

      await CacheService.deletePhoneOtpCode(userId);

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
    };
  }

  private static shouldSkipSendChamp(): boolean {
    return (
      process.env.SENDCHAMP_SKIP_VERIFICATION === 'true' ||
      process.env.NODE_ENV === 'development'
    );
  }

  private static generateNumericOtp(length: number): string {
    const min = 10 ** (length - 1);
    const max = 10 ** length - 1;
    return String(crypto.randomInt(min, max + 1));
  }

  private static async sendSmsOtp(userId: string, phoneNumber: string): Promise<void> {
    const mobile = formatPhoneForSendChamp(phoneNumber);
    const otp = this.generateNumericOtp(6);

    await CacheService.storePhoneOtpCode(userId, otp, OTP_EXPIRY_SECONDS);

    if (this.shouldSkipSendChamp()) {
      logger.info('SendChamp skip enabled — SMS not sent', {
        phone: maskPhoneForLog(mobile),
      });
      return;
    }

    if (!process.env.SENDCHAMP_API_KEY?.trim()) {
      await CacheService.deletePhoneOtpCode(userId);
      throw new Error(
        'We could not send your verification code right now. Please try again later.'
      );
    }

    const sender = process.env.SENDCHAMP_SMS_SENDER?.trim() || 'Sendchamp';
    const route = process.env.SENDCHAMP_SMS_ROUTE?.trim() || 'dnd';
    const message = `Your Plz verification code is ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share this code.`;

    try {
      const response = await axios.post(
        'https://api.sendchamp.com/api/v1/sms/send',
        {
          to: [mobile],
          message,
          sender_name: sender,
          route,
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
        throw new Error(response.data?.message || 'Failed to send SMS');
      }

      logger.info('OTP SMS sent via SendChamp', {
        phone: maskPhoneForLog(mobile),
        sender,
        route,
        smsId: response.data?.data?.id,
      });
    } catch (error: any) {
      await CacheService.deletePhoneOtpCode(userId);
      logger.error('SendChamp SMS send failed', {
        error: error.message,
        response: error.response?.data,
        phone: maskPhoneForLog(mobile),
        sender,
        route,
      });
      throw new Error(
        mapSendChampErrorMessage(error.response?.data?.message ?? error.message)
      );
    }
  }

  static maskPhoneNumber(phoneNumber: string): string {
    if (phoneNumber.length < 7) return phoneNumber;
    const start = phoneNumber.slice(0, 7);
    const end = phoneNumber.slice(-3);
    return `${start}****${end}`;
  }
}

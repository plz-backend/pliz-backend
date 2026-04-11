import prisma from '../../../config/database';
import axios from 'axios';
import crypto from 'crypto';
import logger from '../../../config/logger';
import { DocumentVerificationService } from './document-verification.service';
import {
  ISubmitKYCRequest,
  IKYCResponse,
  IKYCStatusResponse,
  IProviderVerificationResult,
} from '../types/kyc.interface';

const MAX_ATTEMPTS = 3;
const OTP_EXPIRY_MINUTES = 10;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

export class KYCService {

  // ============================================
  // GET KYC STATUS
  // Returns full status + phone from profile
  // + step progress for frontend
  // ============================================
  static async getKYCStatus(userId: string): Promise<IKYCStatusResponse> {
    const [verification, profile] = await Promise.all([
      prisma.userVerification.findUnique({ where: { userId } }),
      prisma.userProfile.findUnique({
        where: { userId },
        select: { phoneNumber: true },
      }),
    ]);

    const attemptsRemaining = verification
      ? Math.max(0, MAX_ATTEMPTS - verification.attemptCount)
      : MAX_ATTEMPTS;

    const canRetry = verification
      ? verification.status === 'rejected' && verification.attemptCount < MAX_ATTEMPTS
      : false;

    const steps = [
      {
        step: 1,
        label: 'Profile Completed',
        completed: !!profile,
        description: 'Complete your profile with your personal details',
      },
      {
        step: 2,
        label: 'Phone Verified',
        completed: verification?.phoneVerified || false,
        description: `Verify your phone number ${profile?.phoneNumber ? `(${profile.phoneNumber})` : ''}`,
      },
      {
        step: 3,
        label: 'Identity Verified',
        completed: verification?.isVerified || false,
        description: 'Verify your identity with BVN, NIN, or Passport',
      },
    ];

    return {
      verification: verification ? this.formatResponse(verification) : null,
      phoneNumber: profile?.phoneNumber || null,
      steps,
      attemptsRemaining,
      canRetry,
      ui: this.buildUIMessage(verification?.status || null, canRetry, attemptsRemaining),
    };
  }

  // ============================================
  // SEND PHONE OTP
  // Uses phone number from profile
  // ============================================
  static async sendPhoneOTP(userId: string): Promise<void> {
    try {
      const profile = await prisma.userProfile.findUnique({
        where: { userId },
        select: { phoneNumber: true },
      });

      if (!profile?.phoneNumber) {
        throw new Error('Phone number not found. Please complete your profile first.');
      }

      const existing = await prisma.userVerification.findUnique({
        where: { userId },
        select: { phoneVerified: true },
      });

      if (existing?.phoneVerified) {
        throw new Error('Phone number is already verified.');
      }

      const otp = crypto.randomInt(100000, 999999).toString();
      const otpExpiresAt = new Date();
      otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

      await prisma.userVerification.upsert({
        where: { userId },
        create: {
          userId,
          phoneOtp: otp,
          phoneOtpExpiresAt: otpExpiresAt,
          status: 'pending',
          attemptCount: 0,
        },
        update: {
          phoneOtp: otp,
          phoneOtpExpiresAt: otpExpiresAt,
        },
      });

      await this.sendSMS(
        profile.phoneNumber,
        `Your Plz verification code is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share this code with anyone.`
      );

      logger.info('Phone OTP sent', { userId });
    } catch (error: any) {
      logger.error('Failed to send phone OTP', { error: error.message, userId });
      throw error;
    }
  }

  // ============================================
  // RESEND PHONE OTP
  // 60 second cooldown between resends
  // ============================================
  static async resendPhoneOTP(userId: string): Promise<void> {
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
            phoneOtpExpiresAt: true,
          },
        }),
      ]);

      if (!profile?.phoneNumber) {
        throw new Error('Phone number not found. Please complete your profile first.');
      }

      if (verification?.phoneVerified) {
        throw new Error('Phone number is already verified.');
      }

      // Enforce 60 second cooldown
      if (verification?.phoneOtpExpiresAt) {
        const otpCreatedAt = new Date(verification.phoneOtpExpiresAt);
        otpCreatedAt.setMinutes(otpCreatedAt.getMinutes() - OTP_EXPIRY_MINUTES);
        const secondsSinceSent = (Date.now() - otpCreatedAt.getTime()) / 1000;

        if (secondsSinceSent < OTP_RESEND_COOLDOWN_SECONDS) {
          const secondsRemaining = Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - secondsSinceSent);
          throw new Error(`Please wait ${secondsRemaining} seconds before requesting a new OTP.`);
        }
      }

      const otp = crypto.randomInt(100000, 999999).toString();
      const otpExpiresAt = new Date();
      otpExpiresAt.setMinutes(otpExpiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

      await prisma.userVerification.upsert({
        where: { userId },
        create: {
          userId,
          phoneOtp: otp,
          phoneOtpExpiresAt: otpExpiresAt,
          status: 'pending',
          attemptCount: 0,
        },
        update: {
          phoneOtp: otp,
          phoneOtpExpiresAt: otpExpiresAt,
        },
      });

      await this.sendSMS(
        profile.phoneNumber,
        `Your new Plz verification code is: ${otp}. Valid for ${OTP_EXPIRY_MINUTES} minutes. Do not share this code with anyone.`
      );

      logger.info('Phone OTP resent', { userId });
    } catch (error: any) {
      logger.error('Failed to resend phone OTP', { error: error.message, userId });
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
          phoneOtpExpiresAt: true,
          phoneVerified: true,
        },
      });

      if (!verification) throw new Error('Please request an OTP first.');
      if (verification.phoneVerified) throw new Error('Phone number is already verified.');
      if (!verification.phoneOtp || !verification.phoneOtpExpiresAt) {
        throw new Error('No OTP found. Please request a new OTP.');
      }
      if (new Date() > verification.phoneOtpExpiresAt) {
        throw new Error('OTP has expired. Please request a new one.');
      }
      if (verification.phoneOtp !== otp) {
        throw new Error('Invalid OTP. Please check and try again.');
      }

      await prisma.userVerification.update({
        where: { userId },
        data: {
          phoneVerified: true,
          phoneVerifiedAt: new Date(),
          phoneOtp: null,
          phoneOtpExpiresAt: null,
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
      logger.error('Phone OTP verification failed', { error: error.message, userId });
      throw error;
    }
  }

  // ============================================
  // SUBMIT KYC — first time submission
  // ============================================
  static async submitKYC(
    userId: string,
    data: ISubmitKYCRequest
  ): Promise<IKYCResponse> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true, verification: true },
      });

      if (!user) throw new Error('User not found');
      if (!user.profile) throw new Error('Please complete your profile before KYC verification');
      if (!user.verification?.phoneVerified) {
        throw new Error('Please verify your phone number first before submitting identity verification');
      }
      if (user.verification?.isVerified) throw new Error('You are already verified');
      if (user.verification && user.verification.attemptCount >= MAX_ATTEMPTS) {
        throw new Error(`Maximum verification attempts (${MAX_ATTEMPTS}) reached. Please contact support@plz.app`);
      }

      this.validateKYCData(data);

      const verification = await prisma.userVerification.upsert({
        where: { userId },
        create: {
          userId,
          ...this.buildTypeData(data),
          status: 'pending',
          attemptCount: 1,
          lastAttemptAt: new Date(),
        },
        update: {
          ...this.buildTypeData(data),
          status: 'pending',
          rejectionReason: null,
          rejectedAt: null,
          rejectedBy: null,
          attemptCount: { increment: 1 },
          lastAttemptAt: new Date(),
        },
      });

      logger.info('KYC submitted', { userId, type: data.verificationType });

      // Auto verify in background
      this.autoVerify(userId, data, user.profile).catch(err => {
        logger.error('Auto verification failed', { error: err.message, userId });
      });

      return this.formatResponse(verification);
    } catch (error: any) {
      logger.error('KYC submission failed', { error: error.message, userId });
      throw error;
    }
  }

  // ============================================
  // UPDATE KYC — resubmit after rejection
  // ============================================
  static async updateKYC(
    userId: string,
    data: ISubmitKYCRequest
  ): Promise<IKYCResponse> {
    try {
      const verification = await prisma.userVerification.findUnique({
        where: { userId },
        select: {
          status: true,
          isVerified: true,
          attemptCount: true,
          phoneVerified: true,
        },
      });

      if (!verification) {
        throw new Error('No verification found. Please submit your verification first.');
      }
      if (verification.isVerified) {
        throw new Error('You are already verified. No update needed.');
      }
      if (verification.status !== 'rejected') {
        const statusMessages: Record<string, string> = {
          pending: 'Your verification is still pending. Please wait for the result.',
          under_review: 'Your verification is under review. Please wait for the result.',
        };
        throw new Error(statusMessages[verification.status] || 'Cannot update verification at this time.');
      }
      if (verification.attemptCount >= MAX_ATTEMPTS) {
        throw new Error(`Maximum verification attempts (${MAX_ATTEMPTS}) reached. Please contact support@plz.app`);
      }
      if (!verification.phoneVerified) {
        throw new Error('Please verify your phone number first.');
      }

      this.validateKYCData(data);

      const updated = await prisma.userVerification.update({
        where: { userId },
        data: {
          ...this.buildTypeData(data),
          status: 'pending',
          rejectionReason: null,
          rejectedAt: null,
          rejectedBy: null,
          attemptCount: { increment: 1 },
          lastAttemptAt: new Date(),
        },
      });

      logger.info('KYC resubmitted', { userId, type: data.verificationType, attempt: updated.attemptCount });

      // Get profile for auto verify
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true },
      });

      this.autoVerify(userId, data, user!.profile!).catch(err => {
        logger.error('Auto re-verification failed', { error: err.message, userId });
      });

      return this.formatResponse(updated);
    } catch (error: any) {
      logger.error('KYC update failed', { error: error.message, userId });
      throw error;
    }
  }

  // ============================================
  // AUTO VERIFY
  // Step 1: Document check (NIN + Passport only)
  // Step 2: Provider API call
  // ============================================
  private static async autoVerify(
    userId: string,
    data: ISubmitKYCRequest,
    profile: any
  ): Promise<void> {
    try {
      await prisma.userVerification.update({
        where: { userId },
        data: { status: 'under_review' },
      });

      // ── STEP 1: DOCUMENT CHECK ────────────────
      if (data.verificationType === 'nin') {
        const docResult = await DocumentVerificationService.verifyNINDocument(
          data.nin!,
          data.ninFrontUrl!,
          profile.firstName,
          profile.lastName,
          data.ninDocumentType!,
          data.ninBackUrl,
        );
        if (!docResult.valid) {
          await this.rejectKYC(userId, docResult.error!, 'document_check_failed');
          return;
        }
      }

      if (data.verificationType === 'passport') {
        const docResult = await DocumentVerificationService.verifyPassportDocument(
          data.passportNumber!,
          data.passportBiodataUrl!,
          profile.firstName,
          profile.lastName,
        );
        if (!docResult.valid) {
          await this.rejectKYC(userId, docResult.error!, 'document_check_failed');
          return;
        }
      }

      // ── STEP 2: PROVIDER API ──────────────────
      let result: IProviderVerificationResult;

      switch (data.verificationType) {
        case 'bvn':
          result = await this.verifyBVN(
            data.bvn!,
            profile.firstName,
            profile.lastName,
          );
          break;
        case 'nin':
          result = await this.verifyNIN(
            data.nin!,
            profile.firstName,
            profile.lastName,
          );
          break;
        case 'passport':
          result = await this.verifyPassport(
            data.passportNumber!,
            profile.firstName,
            profile.lastName,
            profile.dateOfBirth.toISOString().split('T')[0],
            data.passportExpiry!,
          );
          break;
        default:
          throw new Error('Invalid verification type');
      }

      if (result.verified) {
        await prisma.userVerification.update({
          where: { userId },
          data: {
            status: 'verified',
            isVerified: true,
            verifiedAt: new Date(),
            documentVerified: data.verificationType !== 'bvn',
            verificationProvider: data.verificationType === 'bvn' ? 'paystack' : 'youverify',
            providerReference: result.reference,
            providerResponse: result.data as any,
            ...(data.verificationType === 'bvn' && { bvnVerified: true, bvnVerifiedAt: new Date() }),
            ...(data.verificationType === 'nin' && { ninVerified: true, ninVerifiedAt: new Date() }),
            ...(data.verificationType === 'passport' && { passportVerified: true, passportVerifiedAt: new Date() }),
          },
        });

        await prisma.notification.create({
          data: {
            userId,
            type: 'kyc_verified',
            title: '🎉 Identity Verified!',
            body: 'Your identity has been verified. You can now create begs and receive donations on Plz!',
            data: { verificationType: data.verificationType },
          },
        });

        logger.info('KYC verified', { userId, type: data.verificationType });
      } else {
        await this.rejectKYC(userId, result.error!, 'api_verification_failed');
      }
    } catch (error: any) {
      // Provider down — set to under_review for manual check
      await prisma.userVerification.update({
        where: { userId },
        data: {
          status: 'under_review',
          providerResponse: { error: error.message } as any,
        },
      });
      logger.error('Auto verification error — set to under_review', { error: error.message, userId });
    }
  }

  // ============================================
  // REJECT KYC — shared helper
  // ============================================
  private static async rejectKYC(
    userId: string,
    reason: string,
    failureType: string
  ): Promise<void> {
    const updated = await prisma.userVerification.update({
      where: { userId },
      data: {
        status: 'rejected',
        rejectionReason: reason,
        rejectedAt: new Date(),
      },
      select: { attemptCount: true },
    });

    const attemptsRemaining = Math.max(0, MAX_ATTEMPTS - updated.attemptCount);

    await prisma.notification.create({
      data: {
        userId,
        type: 'kyc_rejected',
        title: '❌ Verification Failed',
        body: reason,
        data: {
          failureType,
          attemptsRemaining,
          canRetry: attemptsRemaining > 0,
        },
      },
    });

    logger.warn('KYC rejected', { userId, reason, failureType });
  }

  // ============================================
  // BVN VERIFICATION — Paystack
  // ============================================
  private static async verifyBVN(
    bvn: string,
    firstName: string,
    lastName: string,
  ): Promise<IProviderVerificationResult> {
    try {
      const response = await axios.post(
        'https://api.paystack.co/bank/resolve_bvn',
        { bvn },
        {
          headers: {
            Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = response.data?.data;
      const firstNameMatch = result?.first_name?.toLowerCase().includes(firstName.toLowerCase());
      const lastNameMatch = result?.last_name?.toLowerCase().includes(lastName.toLowerCase());

      if (!firstNameMatch || !lastNameMatch) {
        return {
          success: false,
          verified: false,
          reference: bvn,
          data: result,
          error: 'The name on your BVN does not match your profile name. Please update your profile name to match your BVN exactly.',
        };
      }

      return { success: true, verified: true, reference: bvn, data: result };
    } catch (error: any) {
      return {
        success: false,
        verified: false,
        reference: bvn,
        error: error.response?.data?.message || 'BVN verification failed. Please try again.',
      };
    }
  }

  // ============================================
  // NIN VERIFICATION — Youverify
  // ============================================
  private static async verifyNIN(
    nin: string,
    firstName: string,
    lastName: string,
  ): Promise<IProviderVerificationResult> {
    try {
      const response = await axios.post(
        'https://api.youverify.co/v2/api/identity/ng/nin',
        { id: nin, isSubjectConsent: true },
        {
          headers: {
            token: process.env.YOUVERIFY_API_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = response.data?.data;
      const firstNameMatch = result?.firstName?.toLowerCase().includes(firstName.toLowerCase());
      const lastNameMatch = result?.lastName?.toLowerCase().includes(lastName.toLowerCase());

      if (!firstNameMatch || !lastNameMatch) {
        return {
          success: false,
          verified: false,
          reference: nin,
          data: result,
          error: 'The name on your NIN does not match your profile name. Please update your profile name to match your NIN exactly.',
        };
      }

      return { success: true, verified: true, reference: nin, data: result };
    } catch (error: any) {
      return {
        success: false,
        verified: false,
        reference: nin,
        error: error.response?.data?.message || 'NIN verification failed. Please try again.',
      };
    }
  }

  // ============================================
  // PASSPORT VERIFICATION — Youverify
  // ============================================
  private static async verifyPassport(
    passportNumber: string,
    firstName: string,
    lastName: string,
    dateOfBirth: string,
    passportExpiry: string,
  ): Promise<IProviderVerificationResult> {
    try {
      if (new Date(passportExpiry) < new Date()) {
        return {
          success: false,
          verified: false,
          reference: passportNumber,
          error: 'Your passport has expired. Please use a valid passport or choose BVN/NIN instead.',
        };
      }

      const response = await axios.post(
        'https://api.youverify.co/v2/api/identity/ng/passport',
        {
          id: passportNumber,
          isSubjectConsent: true,
          lastName,
          dateOfBirth,
        },
        {
          headers: {
            token: process.env.YOUVERIFY_API_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      const result = response.data?.data;
      return { success: true, verified: true, reference: passportNumber, data: result };
    } catch (error: any) {
      return {
        success: false,
        verified: false,
        reference: passportNumber,
        error: error.response?.data?.message || 'Passport verification failed. Please try again.',
      };
    }
  }

  // ============================================
  // SMS — Termii (popular in Nigeria)
  // ============================================
  private static async sendSMS(phoneNumber: string, message: string): Promise<void> {
    try {
      await axios.post(
        'https://api.ng.termii.com/api/sms/send',
        {
          to: phoneNumber,
          from: 'Plz',
          sms: message,
          type: 'plain',
          channel: 'generic',
          api_key: process.env.TERMII_API_KEY,
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      logger.info('SMS sent', { phone: phoneNumber });
    } catch (error: any) {
      logger.error('SMS sending failed', { error: error.message });
      throw new Error('Failed to send OTP. Please try again.');
    }
  }

  // ============================================
  // VALIDATE KYC DATA
  // ============================================
  private static validateKYCData(data: ISubmitKYCRequest): void {
    switch (data.verificationType) {
      case 'bvn':
        if (!data.bvn) throw new Error('BVN is required');
        if (!/^\d{11}$/.test(data.bvn)) throw new Error('BVN must be exactly 11 digits');
        break;
      case 'nin':
        if (!data.nin) throw new Error('NIN is required');
        if (!/^\d{11}$/.test(data.nin)) throw new Error('NIN must be exactly 11 digits');
        if (!data.ninDocumentType) throw new Error('Please select your NIN document type (slip or id_card)');
        if (!data.ninFrontUrl) throw new Error('Front of your NIN document is required');
        if (data.ninDocumentType === 'id_card' && !data.ninBackUrl) {
          throw new Error('Back of your NIN card is required');
        }
        break;
      case 'passport':
        if (!data.passportNumber) throw new Error('Passport number is required');
        if (!data.passportExpiry) throw new Error('Passport expiry date is required');
        if (!data.passportBiodataUrl) throw new Error('Passport biodata page upload is required');
        if (new Date(data.passportExpiry) < new Date()) {
          throw new Error('Your passport has expired. Please use BVN or NIN instead.');
        }
        break;
      default:
        throw new Error('Invalid verification type. Must be bvn, nin, or passport');
    }
  }

  // ============================================
  // BUILD TYPE DATA FOR UPSERT
  // Clears other type fields to avoid stale data
  // ============================================
  private static buildTypeData(data: ISubmitKYCRequest) {
    switch (data.verificationType) {
      case 'bvn':
        return {
          verificationType: 'bvn',
          bvn: data.bvn,
          nin: null, ninDocumentType: null, ninFrontUrl: null, ninBackUrl: null,
          passportNumber: null, passportExpiry: null, passportBiodataUrl: null,
        };
      case 'nin':
        return {
          verificationType: 'nin',
          nin: data.nin,
          ninDocumentType: data.ninDocumentType,
          ninFrontUrl: data.ninFrontUrl,
          ninBackUrl: data.ninBackUrl || null,
          bvn: null,
          passportNumber: null, passportExpiry: null, passportBiodataUrl: null,
        };
      case 'passport':
        return {
          verificationType: 'passport',
          passportNumber: data.passportNumber,
          passportExpiry: data.passportExpiry ? new Date(data.passportExpiry) : null,
          passportBiodataUrl: data.passportBiodataUrl,
          bvn: null,
          nin: null, ninDocumentType: null, ninFrontUrl: null, ninBackUrl: null,
        };
    }
  }

  // ============================================
  // BUILD UI MESSAGE
  // ============================================
  private static buildUIMessage(
    status: string | null,
    canRetry: boolean,
    attemptsRemaining: number
  ) {
    if (!status) {
      return {
        title: 'Verify Your Identity',
        body: 'To create a beg and receive donations, we need to verify your identity. It takes less than 2 minutes.',
        buttonLabel: 'Start Verification',
        buttonUrl: '/kyc/start',
      };
    }

    const messages: Record<string, any> = {
      pending: {
        title: 'Verification Pending',
        body: 'Your verification is being processed. This usually takes less than 2 minutes.',
        buttonLabel: 'Check Status',
        buttonUrl: '/kyc/status',
      },
      under_review: {
        title: 'Under Review',
        body: 'Our team is reviewing your documents. You will be notified once complete.',
        buttonLabel: 'Check Status',
        buttonUrl: '/kyc/status',
      },
      verified: {
        title: 'Identity Verified ✅',
        body: 'Your identity has been verified. You can now create begs on Plz.',
        buttonLabel: 'Create a Beg',
        buttonUrl: '/begs/create',
      },
      rejected: {
        title: 'Verification Failed',
        body: canRetry
          ? `Please correct your details and try again. You have ${attemptsRemaining} attempt${attemptsRemaining > 1 ? 's' : ''} remaining.`
          : 'Maximum attempts reached. Please contact support@plz.app',
        buttonLabel: canRetry ? 'Try Again' : 'Contact Support',
        buttonUrl: canRetry ? '/kyc/start' : 'mailto:support@plz.app',
      },
    };

    return messages[status] || messages.pending;
  }

  // ============================================
  // FORMAT RESPONSE
  // ============================================
  private static formatResponse(verification: any): IKYCResponse {
    return {
      userId: verification.userId,
      verificationType: verification.verificationType,
      status: verification.status,
      isVerified: verification.isVerified,
      phoneVerified: verification.phoneVerified,
      verifiedAt: verification.verifiedAt,
      rejectionReason: verification.rejectionReason,
      attemptCount: verification.attemptCount,
      attemptsRemaining: Math.max(0, MAX_ATTEMPTS - verification.attemptCount),
      canRetry: verification.status === 'rejected' && verification.attemptCount < MAX_ATTEMPTS,
      createdAt: verification.createdAt,
      updatedAt: verification.updatedAt,
    };
  }
}
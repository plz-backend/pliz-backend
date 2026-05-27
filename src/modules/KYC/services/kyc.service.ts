import prisma from '../../../config/database';
import { Prisma } from '@prisma/client';
import logger from '../../../config/logger';
import { AdminService } from '../../admin/services/admin.service';
import { TrustScoreService } from '../../../services/trust_score.service';
import { maskPhoneForLog } from '../../../utils/sanitize-log';
import { PhoneVerificationService } from './phone-verification.service';
import { IdentityVerificationService } from './identity-verification.service';
import { KYCDocumentUploadService } from './document-upload.service';
import {
  IUploadDocumentRequest,
  IKYCResponse,
  IKYCStatusResponse,
  KYCStatus,
} from '../types/kyc.interface';

const MAX_ATTEMPTS = 3;

function canRetryAfterRejection(verification: {
  status: string;
  attemptCount: number;
  verificationType?: string | null;
}): boolean {
  if (verification.status !== 'rejected') return false;
  if (verification.attemptCount < MAX_ATTEMPTS) return true;
  // Legacy passport path removed — let users restart with NIN.
  return verification.verificationType === 'passport';
}

function isValidNinOrVnin(value: string): boolean {
  const trimmed = value.trim();
  if (/^\d{11}$/.test(trimmed.replace(/\D/g, ''))) return true;
  return /^[A-Za-z0-9]{16}$/.test(trimmed.replace(/\s/g, ''));
}

function normalizeNinOrVnin(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (/^\d{11}$/.test(digits)) return digits;
  return trimmed.replace(/\s/g, '').toUpperCase();
}

export class KYCService {

  // ============================================
  // GET KYC STATUS
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

    const canRetry = verification ? canRetryAfterRejection(verification) : false;

    const steps = [
      {
        step: 1,
        label: 'Profile completed',
        completed: !!profile,
        description: 'Complete your profile with your personal details',
      },
      {
        step: 2,
        label: 'Phone verified',
        completed: verification?.phoneVerified || false,
        description: `Verify your phone number${
          profile?.phoneNumber ? ` (${profile.phoneNumber})` : ''
        }`,
      },
      {
        step: 3,
        label: 'Document uploaded',
        completed: verification?.documentVerified || false,
        description: 'Fill in your NIN details and upload your NIN slip or card',
      },
      {
        step: 4,
        label: 'Identity verified',
        completed: verification?.isVerified || false,
        description: 'Prembly verifies your identity against government records',
      },
    ];

    return {
      verification: verification ? this.formatResponse(verification) : null,
      phoneNumber: profile?.phoneNumber || null,
      steps,
      attemptsRemaining,
      canRetry,
      ui: this.buildUIMessage(
        (verification?.status as KYCStatus) || null,
        verification?.verificationType ?? null,
        canRetry,
        attemptsRemaining
      ),
    };
  }

  // ============================================
  // PHONE VERIFICATION
  // Delegated to PhoneVerificationService
  // ============================================
  static async sendPhoneOTP(
    userId: string,
    channel: 'sms' | 'whatsapp' = 'sms'
  ): Promise<{ phoneNumber: string; channel: 'sms' | 'whatsapp' }> {
    return PhoneVerificationService.sendPhoneOTP(userId, channel);
  }

  static async resendPhoneOTP(
    userId: string,
    channel: 'sms' | 'whatsapp' = 'sms'
  ): Promise<{ phoneNumber: string; channel: 'sms' | 'whatsapp' }> {
    return PhoneVerificationService.resendPhoneOTP(userId, channel);
  }

  static async verifyPhoneOTP(userId: string, otp: string): Promise<void> {
    return PhoneVerificationService.verifyPhoneOTP(userId, otp);
  }

  // ============================================
  // UPLOAD DOCUMENT
  // Step 3 — validate fields, store image, save metadata
  // Identity is verified at submit via IdentityVerificationService
  // ============================================
  static async uploadDocument(
    userId: string,
    fileBuffer: Buffer,
    mimeType: string,
    data: IUploadDocumentRequest
  ): Promise<IKYCResponse> {
    try {
      const verification = await prisma.userVerification.findUnique({
        where: { userId },
        select: {
          phoneVerified: true,
          isVerified: true,
          attemptCount: true,
          ninFrontUrl: true,
        },
      });

      if (!verification?.phoneVerified) {
        throw new Error('Please verify your phone number first.');
      }
      if (verification.isVerified) {
        throw new Error('You are already verified.');
      }

      // ── VALIDATE NIN FIELDS ──────────────────
      if (data.verificationType !== 'nin') {
        throw new Error('Only NIN verification is supported.');
      }

      if (!data.nin || !isValidNinOrVnin(data.nin)) {
        throw new Error(
          'Enter a valid 11-digit NIN or 16-character Virtual NIN (vNIN) from the NIMC app.'
        );
      }
      data.nin = normalizeNinOrVnin(data.nin);
      if (!data.ninDocumentType || !['slip', 'card'].includes(data.ninDocumentType)) {
        throw new Error('Please select NIN document type (slip or card).');
      }

      // ── UPLOAD TO SUPABASE ────────────────────
      const documentUrl = await KYCDocumentUploadService.uploadDocument(
        userId, fileBuffer, mimeType, data.documentType
      );

      // ── BUILD UPDATE DATA ─────────────────────
      const updateData: any = {
        verificationType: 'nin',
        nin: data.nin,
        ninDocumentType: data.ninDocumentType,
      };
      if (data.ninStateOfOrigin) updateData.ninStateOfOrigin = data.ninStateOfOrigin;
      if (data.ninLGA) updateData.ninLGA = data.ninLGA;
      if (data.ninMiddleName) updateData.ninMiddleName = data.ninMiddleName;

      if (data.documentType === 'nin_front') {
        updateData.ninFrontUrl = documentUrl;
        if (data.ninDocumentType === 'slip') {
          updateData.documentVerified = true;
          updateData.documentVerifiedAt = new Date();
          updateData.status = 'document_uploaded';
        }
      } else if (data.documentType === 'nin_back') {
        updateData.ninBackUrl = documentUrl;
        if (verification.ninFrontUrl) {
          updateData.documentVerified = true;
          updateData.documentVerifiedAt = new Date();
          updateData.status = 'document_uploaded';
        }
      }

      const updated = await prisma.userVerification.upsert({
        where: { userId },
        create: {
          userId,
          ...updateData,
          phoneVerified: verification.phoneVerified,
          attemptCount: verification.attemptCount,
        },
        update: updateData,
      });

      logger.info('Document uploaded', {
        userId,
        documentType: data.documentType,
        verificationType: data.verificationType,
      });

      return this.formatResponse(updated);
    } catch (error: any) {
      logger.error('Document upload failed', { error: error.message, userId });
      throw error;
    }
  }

  // ============================================
  // SUBMIT KYC — Final step
  // Validates profile then calls Prembly API
  // ============================================
  static async submitKYC(userId: string): Promise<IKYCResponse> {
    try {
      const [verification, user] = await Promise.all([
        prisma.userVerification.findUnique({
          where: { userId },
        }),
        prisma.user.findUnique({
          where: { id: userId },
          include: {
            profile: {
              select: {
                firstName: true,
                lastName: true,
                dateOfBirth: true,
                gender: true,
                phoneNumber: true,
              },
            },
          },
        }),
      ]);

      if (!verification) throw new Error('Please start KYC verification first.');
      if (!verification.phoneVerified) throw new Error('Please verify your phone number first.');
      if (!verification.documentVerified) throw new Error('Please upload your document first.');
      const readyToSubmit =
        verification.status === 'document_uploaded' ||
        verification.status === 'liveness_passed';

      if (!readyToSubmit) {
        if (verification.status === 'under_review') {
          throw new Error('Your verification is already under review.');
        }
        if (verification.isVerified || verification.status === 'verified') {
          throw new Error('You are already verified.');
        }
        throw new Error('Please upload your document before submitting.');
      }
      if (verification.isVerified) throw new Error('You are already verified.');
      if (verification.attemptCount >= MAX_ATTEMPTS) {
        throw new Error(
          `Maximum attempts (${MAX_ATTEMPTS}) reached. Please contact support@plz.app`
        );
      }
      if (!user?.profile) {
        throw new Error('Please complete your profile before submitting.');
      }
      if (!user.profile.firstName || !user.profile.lastName) {
        throw new Error(
          'Please add your first name and last name in your profile before verifying.'
        );
      }
      if (!user.profile.dateOfBirth) {
        throw new Error('Please add your date of birth in your profile before verifying.');
      }
      if (!user.profile.gender) {
        throw new Error('Please add your gender in your profile before verifying.');
      }

      // Update to under_review
      await prisma.userVerification.update({
        where: { userId },
        data: {
          status: 'under_review',
          attemptCount: { increment: 1 },
          lastAttemptAt: new Date(),
        },
      });

      // Run in background
      this.runVerification(userId, verification, user.profile).catch(err => {
        logger.error('Background verification failed', {
          error: err.message, userId,
        });
      });

      return this.formatResponse(
        await prisma.userVerification.findUnique({ where: { userId } }) as any
      );
    } catch (error: any) {
      logger.error('KYC submit failed', { error: error.message, userId });
      throw error;
    }
  }

  // ============================================
  // UPDATE KYC — Resubmit after rejection
  // ============================================
  static async updateKYC(userId: string): Promise<IKYCResponse> {
    const verification = await prisma.userVerification.findUnique({
      where: { userId },
      select: {
        status: true,
        isVerified: true,
        attemptCount: true,
        verificationType: true,
      },
    });

    if (!verification) {
      throw new Error('No verification found. Please start KYC verification first.');
    }
    if (verification.isVerified) {
      throw new Error('You are already verified.');
    }
    if (verification.status !== 'rejected') {
      const messages: Record<string, string> = {
        pending: 'Please verify your phone number first.',
        document_uploaded:
          'Please submit your verification or complete the remaining steps.',
        liveness_passed: 'Please submit your verification.',
        under_review: 'Your verification is under review. Please wait.',
      };
      throw new Error(messages[verification.status] || 'Cannot update at this time.');
    }
    if (!canRetryAfterRejection(verification)) {
      throw new Error(
        `Maximum attempts (${MAX_ATTEMPTS}) reached. Please contact support@plz.app`
      );
    }

    const resetAttemptCount = verification.verificationType === 'passport';

    // Reset all fields for resubmission
    await prisma.userVerification.update({
      where: { userId },
      data: {
        status: 'pending',
        ...(resetAttemptCount ? { attemptCount: 0 } : {}),
        verificationType: null,
        nin: null,
        ninDocumentType: null,
        ninMiddleName: null,
        ninStateOfOrigin: null,
        ninLGA: null,
        ninEnrollmentDate: null,
        ninFrontUrl: null,
        ninBackUrl: null,
        passportNumber: null,
        passportMiddleName: null,
        passportPlaceOfBirth: null,
        passportIssueDate: null,
        passportExpiry: null,
        passportPlaceOfIssue: null,
        passportBiodataUrl: null,
        documentVerified: false,
        documentVerifiedAt: null,
        faceLivenessPassed: false,
        faceLivenessPassedAt: null,
        faceLivenessUrl: null,
        faceLivenessScore: null,
        rejectionReason: null,
        rejectedAt: null,
        providerResponse: Prisma.JsonNull,   // ← fixed
      } as Prisma.UserVerificationUncheckedUpdateInput,
    });

    // Delete old documents from Supabase
    await KYCDocumentUploadService.deleteDocuments(userId);

    logger.info('KYC reset for resubmission', { userId });

    return this.formatResponse(
      await prisma.userVerification.findUnique({ where: { userId } }) as any
    );
  }

  // ============================================
  // ADMIN — GET ALL VERIFICATIONS
  // ============================================
  static async getAllVerifications(
    page: number = 1,
    limit: number = 20,
    status?: string,
    verificationType?: string
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (status) where.status = status;
    if (verificationType) where.verificationType = verificationType;

    const [verifications, total] = await Promise.all([
      prisma.userVerification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              profile: {
                select: {
                  firstName: true,
                  lastName: true,
                  phoneNumber: true,
                },
              },
            },
          },
        },
      }),
      prisma.userVerification.count({ where }),
    ]);

    return {
      verifications: await Promise.all(
        verifications.map((v) => this.formatAdminResponse(v))
      ),
      total,
      pages: Math.ceil(total / limit),
    };
  }

  // ============================================
  // ADMIN — GET SINGLE VERIFICATION
  // ============================================
  static async getVerification(userId: string) {
    const verification = await prisma.userVerification.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            username: true,
            profile: {
              select: {
                firstName: true,
                lastName: true,
                phoneNumber: true,
                dateOfBirth: true,
                gender: true,
              },
            },
          },
        },
      },
    });

    if (!verification) throw new Error('Verification not found');

    return this.formatAdminResponse(verification);
  }

  // ============================================
  // ADMIN — MANUALLY VERIFY
  // ============================================
  static async manuallyVerify(
    userId: string,
    adminId: string,
    note?: string
  ): Promise<void> {
    const verification = await prisma.userVerification.findUnique({
      where: { userId },
      select: { status: true, isVerified: true, verificationType: true },
    });

    if (!verification) throw new Error('Verification not found');
    if (verification.isVerified) throw new Error('User is already verified');

    await prisma.userVerification.update({
      where: { userId },
      data: {
        status: 'verified',
        isVerified: true,
        verifiedAt: new Date(),
        verificationProvider: 'manual',
        providerReference: `MANUAL-${adminId}-${Date.now()}`,
        providerResponse: {
          manuallyVerifiedBy: adminId,
          note: note || 'Manually verified by admin',
          verifiedAt: new Date().toISOString(),
        },
        ...(verification.verificationType === 'nin'
          ? { ninVerified: true, ninVerifiedAt: new Date() }
          : { passportVerified: true, passportVerifiedAt: new Date() }
        ),
      },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: 'kyc_verified',
        title: '🎉 Identity Verified!',
        body: 'Your identity has been verified. You can now create begs and receive donations on Plz!',
        data: { manuallyVerified: true },
      },
    });

    await TrustScoreService.invalidateTrustScoreCache(userId);

    logger.info('User manually verified by admin', { userId, adminId });

    await AdminService.logAction({
      adminId,
      actionType: 'kyc_manual_verify',
      targetType: 'user',
      targetId: userId,
      description: `Manually verified KYC for user ${userId}`,
      metadata: { note: note || null },
    });
  }

  // ============================================
  // ADMIN — MANUALLY REJECT
  // ============================================
  static async manuallyReject(
    userId: string,
    adminId: string,
    reason: string
  ): Promise<void> {
    const verification = await prisma.userVerification.findUnique({
      where: { userId },
      select: { status: true, isVerified: true, attemptCount: true },
    });

    if (!verification) throw new Error('Verification not found');
    if (verification.isVerified) throw new Error('Cannot reject an already verified user');

    const attemptsRemaining = Math.max(0, MAX_ATTEMPTS - verification.attemptCount);

    await prisma.userVerification.update({
      where: { userId },
      data: {
        status: 'rejected',
        rejectionReason: reason,
        rejectedAt: new Date(),
        rejectedBy: adminId,
      },
    });

    await prisma.notification.create({
      data: {
        userId,
        type: 'kyc_rejected',
        title: '❌ Verification Failed',
        body: reason,
        data: {
          attemptsRemaining,
          canRetry: attemptsRemaining > 0,
          rejectedBy: 'admin',
        },
      },
    });

    logger.warn('Verification rejected by admin', { userId, adminId, reason });

    await AdminService.logAction({
      adminId,
      actionType: 'kyc_manual_reject',
      targetType: 'user',
      targetId: userId,
      description: `Rejected KYC for user ${userId}`,
      metadata: { reason },
    });
  }

  // ============================================
  // ADMIN — GET VERIFICATION STATS
  // ============================================
  static async getVerificationStats() {
    const [
      total,
      pending,
      documentUploaded,
      livenessPassed,
      underReview,
      verified,
      rejected,
      ninCount,
      passportCount,
    ] = await Promise.all([
      prisma.userVerification.count(),
      prisma.userVerification.count({ where: { status: 'pending' } }),
      prisma.userVerification.count({ where: { status: 'document_uploaded' } }),
      prisma.userVerification.count({ where: { status: 'liveness_passed' } }),
      prisma.userVerification.count({ where: { status: 'under_review' } }),
      prisma.userVerification.count({ where: { status: 'verified' } }),
      prisma.userVerification.count({ where: { status: 'rejected' } }),
      prisma.userVerification.count({ where: { verificationType: 'nin' } }),
      prisma.userVerification.count({ where: { verificationType: 'passport' } }),
    ]);

    return {
      total,
      byStatus: {
        pending,
        documentUploaded,
        livenessPassed,
        underReview,
        verified,
        rejected,
      },
      byType: {
        nin: ninCount,
        passport: passportCount,
      },
      verificationRate: total > 0
        ? Math.round((verified / total) * 100)
        : 0,
    };
  }

  // ============================================
  // RUN VERIFICATION IN BACKGROUND
  // Calls Prembly after all steps complete
  // ============================================
  private static async runVerification(
    userId: string,
    verification: any,
    profile: any
  ): Promise<void> {
    try {
      if (verification.verificationType !== 'nin' || !verification.nin) {
        await this.rejectKYC(
          userId,
          'Only NIN verification is supported. Please verify with your NIN.',
          verification.attemptCount
        );
        return;
      }

      const result = await IdentityVerificationService.verifyNIN(verification.nin, {
        firstName: profile.firstName,
        lastName: profile.lastName,
        dateOfBirth: profile.dateOfBirth,
        gender: profile.gender,
        phoneNumber: profile.phoneNumber,
      });

      if (result.verified) {
        await prisma.userVerification.update({
          where: { userId },
          data: {
            status: 'verified',
            isVerified: true,
            verifiedAt: new Date(),
            verificationProvider: 'prembly',
            providerReference: result.reference,
            providerResponse: result.data,
            ...(verification.verificationType === 'nin'
              ? { ninVerified: true, ninVerifiedAt: new Date() }
              : { passportVerified: true, passportVerifiedAt: new Date() }
            ),
          },
        });

        await prisma.notification.create({
          data: {
            userId,
            type: 'kyc_verified',
            title: '🎉 Identity Verified!',
            body: 'Your identity has been verified. You can now create begs and receive donations on Plz!',
            data: { verificationType: verification.verificationType },
          },
        });

        await TrustScoreService.invalidateTrustScoreCache(userId);

        logger.info('KYC verified successfully', { userId });
      } else {
        await this.rejectKYC(userId, result.error!, verification.attemptCount);
      }
    } catch (error: any) {
      await prisma.userVerification.update({
        where: { userId },
        data: {
          status: 'under_review',
          providerResponse: { error: error.message },   // ← no cast needed
        },
      });
      logger.error('Verification error — kept under_review', {
        error: error.message, userId,
      });
    }
  }

  // ============================================
  // REJECT KYC — shared helper
  // ============================================
  private static async rejectKYC(
    userId: string,
    reason: string,
    currentAttemptCount: number
  ): Promise<void> {
    await prisma.userVerification.update({
      where: { userId },
      data: {
        status: 'rejected',
        rejectionReason: reason,
        rejectedAt: new Date(),
      },
    });

    const attemptsRemaining = Math.max(0, MAX_ATTEMPTS - currentAttemptCount);

    await prisma.notification.create({
      data: {
        userId,
        type: 'kyc_rejected',
        title: '❌ Verification Failed',
        body: reason,
        data: {
          attemptsRemaining,
          canRetry: attemptsRemaining > 0,
        },
      },
    });

    logger.warn('KYC rejected', { userId, reason });
  }

  // ============================================
  // FORMAT USER RESPONSE
  // ============================================
  private static formatResponse(verification: any): IKYCResponse {
    return {
      id: verification.id,
      userId: verification.userId,
      verificationType: verification.verificationType,
      status: verification.status,
      isVerified: verification.isVerified,
      phoneVerified: verification.phoneVerified,
      documentVerified: verification.documentVerified,
      faceLivenessPassed: verification.faceLivenessPassed,
      faceLivenessScore: verification.faceLivenessScore,
      verifiedAt: verification.verifiedAt,
      rejectionReason: verification.rejectionReason,
      attemptCount: verification.attemptCount,
      attemptsRemaining: Math.max(0, MAX_ATTEMPTS - verification.attemptCount),
      canRetry: canRetryAfterRejection(verification),
      createdAt: verification.createdAt,
      updatedAt: verification.updatedAt,
    };
  }

  // ============================================
  // FORMAT ADMIN RESPONSE
  // Includes document URLs + full details
  // ============================================
  private static async formatAdminResponse(verification: any) {
    const [ninFrontUrl, ninBackUrl, passportBiodataUrl, faceLivenessUrl] =
      await Promise.all([
        KYCDocumentUploadService.createSignedUrl(verification.ninFrontUrl),
        KYCDocumentUploadService.createSignedUrl(verification.ninBackUrl),
        KYCDocumentUploadService.createSignedUrl(verification.passportBiodataUrl),
        KYCDocumentUploadService.createSignedUrl(verification.faceLivenessUrl),
      ]);

    return {
      id: verification.id,
      userId: verification.userId,
      user: verification.user
        ? {
            id: verification.user.id,
            email: verification.user.email,
            username: verification.user.username,
            firstName: verification.user.profile?.firstName,
            lastName: verification.user.profile?.lastName,
            phoneNumber: maskPhoneForLog(verification.user.profile?.phoneNumber),
            dateOfBirth: verification.user.profile?.dateOfBirth,
            gender: verification.user.profile?.gender,
          }
        : null,
      verificationType: verification.verificationType,
      status: verification.status,
      isVerified: verification.isVerified,
      phoneVerified: verification.phoneVerified,
      documentVerified: verification.documentVerified,
      faceLivenessPassed: verification.faceLivenessPassed,
      faceLivenessScore: verification.faceLivenessScore,
      faceLivenessUrl,

      // NIN details — masked for security
      nin: verification.nin
        ? verification.nin.substring(0, 4) + '*******'
        : null,
      ninDocumentType: verification.ninDocumentType,
      ninMiddleName: verification.ninMiddleName,
      ninStateOfOrigin: verification.ninStateOfOrigin,
      ninLGA: verification.ninLGA,
      ninEnrollmentDate: verification.ninEnrollmentDate,
      ninFrontUrl,
      ninBackUrl,
      ninVerified: verification.ninVerified,
      ninVerifiedAt: verification.ninVerifiedAt,

      // Passport details — masked for security
      passportNumber: verification.passportNumber
        ? verification.passportNumber.substring(0, 3) + '*****'
        : null,
      passportMiddleName: verification.passportMiddleName,
      passportPlaceOfBirth: verification.passportPlaceOfBirth,
      passportIssueDate: verification.passportIssueDate,
      passportExpiry: verification.passportExpiry,
      passportPlaceOfIssue: verification.passportPlaceOfIssue,
      passportBiodataUrl,
      passportVerified: verification.passportVerified,
      passportVerifiedAt: verification.passportVerifiedAt,

      // Status info
      verifiedAt: verification.verifiedAt,
      rejectionReason: verification.rejectionReason,
      rejectedAt: verification.rejectedAt,
      rejectedBy: verification.rejectedBy,
      attemptCount: verification.attemptCount,
      attemptsRemaining: Math.max(0, MAX_ATTEMPTS - verification.attemptCount),
      canRetry: canRetryAfterRejection(verification),

      // Provider
      verificationProvider: verification.verificationProvider,
      providerReference: verification.providerReference,

      createdAt: verification.createdAt,
      updatedAt: verification.updatedAt,
    };
  }

  // ============================================
  // BUILD UI MESSAGE
  // ============================================
  private static buildUIMessage(
    status: KYCStatus | null,
    verificationType: string | null,
    canRetry: boolean,
    attemptsRemaining: number
  ): any {
    if (!status) {
      return {
        title: 'Verify your identity',
        body: 'To create a beg and receive donations, verify your identity. Takes less than 3 minutes.',
        buttonLabel: 'Start verification',
        buttonUrl: '/kyc/start',
      };
    }

    const messages: Record<string, any> = {
      pending: {
        title: 'Verify your phone',
        body: 'First step — verify your phone number with an OTP.',
        buttonLabel: 'Verify phone',
        buttonUrl: '/kyc/phone',
      },
      document_uploaded: {
        title: 'Submit verification',
        body: 'Document uploaded! Submit your verification for final NIN check.',
        buttonLabel: 'Submit',
        buttonUrl: '/kyc/submit',
      },
      liveness_passed: {
        title: 'Submit verification',
        body: 'Almost done! Submit your verification for final check.',
        buttonLabel: 'Submit',
        buttonUrl: '/kyc/submit',
      },
      under_review: {
        title: 'Under review',
        body: 'Our team is reviewing your documents. You will be notified once complete.',
        buttonLabel: 'Check status',
        buttonUrl: '/kyc/status',
      },
      verified: {
        title: 'Identity verified',
        body: 'Your identity has been verified. You can now create begs on Plz.',
        buttonLabel: 'Create a beg',
        buttonUrl: '/begs/create',
      },
      rejected: {
        title: 'Verification failed',
        body:
          canRetry &&
          verificationType === 'passport' &&
          attemptsRemaining === 0
            ? 'Passport verification is no longer available. Tap Try again to verify with your NIN.'
            : canRetry
              ? `Please correct your details and try again. You have ${attemptsRemaining} attempt${
                  attemptsRemaining > 1 ? 's' : ''
                } remaining.`
              : 'Maximum attempts reached. Please contact support@plz.ng',
        buttonLabel: canRetry ? 'Try again' : 'Contact support',
        buttonUrl: canRetry ? '/kyc/update' : 'mailto:support@plz.ng',
      },
    };

    return messages[status] || messages.pending;
  }
}

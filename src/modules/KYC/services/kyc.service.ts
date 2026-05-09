import prisma from '../../../config/database';
import { Prisma } from '@prisma/client';
import logger from '../../../config/logger';
import { PhoneVerificationService, type OTPChannel } from './phone-verification.service';
import { DocumentVerificationService } from './document-verification.service';
import { IdentityVerificationService } from './identity-verification.service';
import { KYCDocumentUploadService } from './document-upload.service';
import {
  IUploadDocumentRequest,
  IKYCResponse,
  IKYCStatusResponse,
  KYCStatus,
} from '../types/kyc.interface';

const MAX_ATTEMPTS = 3;

/** UI step — face is done once status has moved past document upload verification. */
const FACE_LIVENESS_STEP_DONE_STATUSES = new Set<string>([
  'liveness_passed',
  'under_review',
  'verified',
]);

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

    const canRetry = verification
      ? verification.status === 'rejected' &&
        verification.attemptCount < MAX_ATTEMPTS
      : false;

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
        description: 'Fill in your document details and upload NIN or Passport',
      },
      {
        step: 4,
        label: 'Face liveness check',
        completed: Boolean(
          verification?.status &&
            FACE_LIVENESS_STEP_DONE_STATUSES.has(verification.status)
        ),
        description: 'Take a selfie to confirm you are a real person',
      },
      {
        step: 5,
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
        canRetry,
        attemptsRemaining
      ),
    };
  }

  // ============================================
  // PHONE VERIFICATION
  // Delegated to PhoneVerificationService
  // ============================================
  static async sendPhoneOTP(userId: string): Promise<{
    channel: OTPChannel;
    phoneNumber: string;
  }> {
    return PhoneVerificationService.sendPhoneOTP(userId);
  }

  static async resendPhoneOTP(userId: string): Promise<{
    channel: OTPChannel;
    phoneNumber: string;
  }> {
    return PhoneVerificationService.resendPhoneOTP(userId);
  }

  static async verifyPhoneOTP(userId: string, otp: string): Promise<void> {
    return PhoneVerificationService.verifyPhoneOTP(userId, otp);
  }

  // ============================================
  // UPLOAD DOCUMENT
  // Step 3 — fill form + upload + check authenticity
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
      if (data.verificationType === 'nin') {
        if (!data.nin || !/^\d{11}$/.test(data.nin)) {
          throw new Error('NIN must be exactly 11 digits.');
        }
        if (!data.ninDocumentType || !['slip', 'card'].includes(data.ninDocumentType)) {
          throw new Error('Please select NIN document type (slip or card).');
        }
        if (!data.ninStateOfOrigin) throw new Error('State of origin is required.');
        if (!data.ninLGA) throw new Error('LGA is required.');
        if (!data.ninEnrollmentDate) throw new Error('Enrollment date is required.');
        if (new Date(data.ninEnrollmentDate) > new Date()) {
          throw new Error('Enrollment date cannot be in the future.');
        }

      // ── VALIDATE PASSPORT FIELDS ─────────────
      } else if (data.verificationType === 'passport') {
        if (!data.passportNumber || !/^[A-Z]{1}[0-9]{8}$/.test(data.passportNumber)) {
          throw new Error('Passport number must be in format A12345678.');
        }
        if (!data.passportPlaceOfBirth) throw new Error('Place of birth is required.');
        if (!data.passportIssueDate) throw new Error('Issue date is required.');
        if (!data.passportExpiry) throw new Error('Expiry date is required.');
        if (!data.passportPlaceOfIssue) throw new Error('Place of issue is required.');
        if (new Date(data.passportExpiry) < new Date()) {
          throw new Error('Your passport has expired. Please use a valid passport.');
        }
        if (new Date(data.passportIssueDate) > new Date()) {
          throw new Error('Issue date cannot be in the future.');
        }
      } else {
        throw new Error('verificationType must be nin or passport.');
      }

      // ── CHECK DOCUMENT AUTHENTICITY ──────────
      const imageBase64 = KYCDocumentUploadService.toBase64(fileBuffer);

      let docCheck: { valid: boolean; error?: string };

      if (data.verificationType === 'nin') {
        docCheck = await DocumentVerificationService.verifyNINDocument(
          imageBase64,
          data.ninDocumentType as 'slip' | 'card'
        );
      } else {
        docCheck = await DocumentVerificationService.verifyPassportDocument(imageBase64);
      }

      if (!docCheck.valid) {
        throw new Error(
          docCheck.error ||
          'Document could not be verified. Please upload a clearer photo.'
        );
      }

      // ── UPLOAD TO SUPABASE ────────────────────
      const documentUrl = await KYCDocumentUploadService.uploadDocument(
        userId, fileBuffer, mimeType, data.documentType
      );

      // ── BUILD UPDATE DATA ─────────────────────
      const updateData: any = {};

      if (data.verificationType === 'nin') {
        updateData.verificationType = 'nin';
        updateData.nin = data.nin;
        updateData.ninDocumentType = data.ninDocumentType;
        updateData.ninStateOfOrigin = data.ninStateOfOrigin;
        updateData.ninLGA = data.ninLGA;
        updateData.ninEnrollmentDate = new Date(data.ninEnrollmentDate!);
        if (data.ninMiddleName) updateData.ninMiddleName = data.ninMiddleName;

        if (data.documentType === 'nin_front') {
          updateData.ninFrontUrl = documentUrl;
          // Slip = one image only → mark document verified
          if (data.ninDocumentType === 'slip') {
            updateData.documentVerified = true;
            updateData.documentVerifiedAt = new Date();
            updateData.status = 'document_uploaded';
          }
          // Card = needs back too → not verified yet
        } else if (data.documentType === 'nin_back') {
          updateData.ninBackUrl = documentUrl;
          // Back uploaded — check if front already exists
          if (verification.ninFrontUrl) {
            updateData.documentVerified = true;
            updateData.documentVerifiedAt = new Date();
            updateData.status = 'document_uploaded';
          }
        }
      } else {
        // Passport
        updateData.verificationType = 'passport';
        updateData.passportNumber = data.passportNumber;
        updateData.passportExpiry = new Date(data.passportExpiry!);
        updateData.passportIssueDate = new Date(data.passportIssueDate!);
        updateData.passportPlaceOfBirth = data.passportPlaceOfBirth;
        updateData.passportPlaceOfIssue = data.passportPlaceOfIssue;
        updateData.passportBiodataUrl = documentUrl;
        if (data.passportMiddleName) {
          updateData.passportMiddleName = data.passportMiddleName;
        }
        // Passport biodata page only → mark document verified
        updateData.documentVerified = true;
        updateData.documentVerifiedAt = new Date();
        updateData.status = 'document_uploaded';
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

      logger.info('Document uploaded and verified', {
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
      if (verification.status !== 'liveness_passed') {
        if (verification.status === 'under_review') {
          throw new Error('Your verification is already under review.');
        }
        if (verification.isVerified || verification.status === 'verified') {
          throw new Error('You are already verified.');
        }
        throw new Error('Please complete the face liveness check first.');
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
      select: { status: true, isVerified: true, attemptCount: true },
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
        document_uploaded: 'Please complete face liveness check.',
        liveness_passed: 'Please submit your verification.',
        under_review: 'Your verification is under review. Please wait.',
      };
      throw new Error(messages[verification.status] || 'Cannot update at this time.');
    }
    if (verification.attemptCount >= MAX_ATTEMPTS) {
      throw new Error(
        `Maximum attempts (${MAX_ATTEMPTS}) reached. Please contact support@plz.app`
      );
    }

    // Reset all fields for resubmission
    await prisma.userVerification.update({
      where: { userId },
      data: {
        status: 'pending',
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
      verifications: verifications.map(v => this.formatAdminResponse(v)),
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

    logger.info('User manually verified by admin', { userId, adminId });
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
      let result;

      if (verification.verificationType === 'nin') {
        result = await IdentityVerificationService.verifyNIN(
          verification.nin,
          {
            firstName: profile.firstName,
            lastName: profile.lastName,
            dateOfBirth: profile.dateOfBirth,
            gender: profile.gender,
            phoneNumber: profile.phoneNumber,
          },
          {
            ninMiddleName: verification.ninMiddleName,
            ninStateOfOrigin: verification.ninStateOfOrigin,
            ninLGA: verification.ninLGA,
            ninEnrollmentDate: verification.ninEnrollmentDate?.toISOString() || '',
          }
        );
      } else {
        result = await IdentityVerificationService.verifyPassport(
          verification.passportNumber,
          verification.passportExpiry?.toISOString() || '',
          {
            firstName: profile.firstName,
            lastName: profile.lastName,
            dateOfBirth: profile.dateOfBirth,
            gender: profile.gender,
          },
          {
            passportMiddleName: verification.passportMiddleName,
            passportPlaceOfBirth: verification.passportPlaceOfBirth,
            passportIssueDate: verification.passportIssueDate?.toISOString() || '',
            passportPlaceOfIssue: verification.passportPlaceOfIssue,
          }
        );
      }

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
      canRetry:
        verification.status === 'rejected' &&
        verification.attemptCount < MAX_ATTEMPTS,
      createdAt: verification.createdAt,
      updatedAt: verification.updatedAt,
    };
  }

  // ============================================
  // FORMAT ADMIN RESPONSE
  // Includes document URLs + full details
  // ============================================
  private static formatAdminResponse(verification: any) {
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
            phoneNumber: verification.user.profile?.phoneNumber,
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
      faceLivenessUrl: verification.faceLivenessUrl,

      // NIN details — masked for security
      nin: verification.nin
        ? verification.nin.substring(0, 4) + '*******'
        : null,
      ninDocumentType: verification.ninDocumentType,
      ninMiddleName: verification.ninMiddleName,
      ninStateOfOrigin: verification.ninStateOfOrigin,
      ninLGA: verification.ninLGA,
      ninEnrollmentDate: verification.ninEnrollmentDate,
      ninFrontUrl: verification.ninFrontUrl,
      ninBackUrl: verification.ninBackUrl,
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
      passportBiodataUrl: verification.passportBiodataUrl,
      passportVerified: verification.passportVerified,
      passportVerifiedAt: verification.passportVerifiedAt,

      // Status info
      verifiedAt: verification.verifiedAt,
      rejectionReason: verification.rejectionReason,
      rejectedAt: verification.rejectedAt,
      rejectedBy: verification.rejectedBy,
      attemptCount: verification.attemptCount,
      attemptsRemaining: Math.max(0, MAX_ATTEMPTS - verification.attemptCount),
      canRetry:
        verification.status === 'rejected' &&
        verification.attemptCount < MAX_ATTEMPTS,

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
        title: 'Face liveness check',
        body: 'Document uploaded! Now take a selfie to confirm you are a real person.',
        buttonLabel: 'Take selfie',
        buttonUrl: '/kyc/liveness',
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
        body: canRetry
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
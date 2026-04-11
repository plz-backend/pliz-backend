import { Request, Response, NextFunction } from 'express';
import prisma from '../../../config/database';        // ← fixed (was ../../../)
import logger from '../../../config/logger';           // ← fixed (was ../../../)

/**
 * Middleware — requires full KYC before creating a beg
 * Checks: phone verified AND identity verified
 * Add to beg creation route
 */
export const requireKYC = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const [verification, profile] = await Promise.all([
      prisma.userVerification.findUnique({
        where: { userId },
        select: {
          isVerified: true,
          phoneVerified: true,
          status: true,
          attemptCount: true,
          rejectionReason: true,
        },
      }),
      prisma.userProfile.findUnique({
        where: { userId },
        select: { phoneNumber: true },
      }),
    ]);

    // ── NO VERIFICATION STARTED ───────────────
    if (!verification) {
      res.status(403).json({
        success: false,
        message: 'Identity verification required before creating a beg',
        data: {
          kycRequired: true,
          phoneVerified: false,
          identityVerified: false,
          nextStep: 'verify_phone',
          phoneNumber: profile?.phoneNumber || null,
          ui: {
            title: 'Verify Your Identity',
            body: 'To protect donors and keep Plz safe, we verify all users before they can receive donations. It takes less than 2 minutes.',
            steps: [
              { step: 1, label: 'Verify Phone Number', completed: false },
              { step: 2, label: 'Verify Identity (BVN / NIN / Passport)', completed: false },
            ],
            options: [
              {
                type: 'bvn',
                label: 'BVN',
                description: 'Recommended — fastest, no scan needed',  // ← updated
                recommended: true,
              },
              {
                type: 'nin',
                label: 'NIN',
                description: 'Scan your NIN slip (front only) or NIN ID card (front + back)',  // ← updated
              },
              {
                type: 'passport',
                label: 'International Passport',
                description: 'Scan the biodata page of your passport',  // ← updated
              },
            ],
            buttonLabel: 'Start Verification',
            buttonUrl: '/kyc/start',
          },
        },
      });
      return;
    }

    // ── PHONE NOT VERIFIED ────────────────────
    if (!verification.phoneVerified) {
      res.status(403).json({
        success: false,
        message: 'Please verify your phone number first',
        data: {
          kycRequired: true,
          phoneVerified: false,
          identityVerified: false,
          nextStep: 'verify_phone',
          phoneNumber: profile?.phoneNumber || null,
          ui: {
            title: 'Verify Your Phone Number',
            body: `We will send a 6-digit code to ${profile?.phoneNumber || 'your phone number'}.`,
            steps: [
              { step: 1, label: 'Verify Phone Number', completed: false },
              { step: 2, label: 'Verify Identity', completed: false },
            ],
            buttonLabel: 'Send OTP',
            buttonUrl: '/kyc/phone/send-otp',
          },
        },
      });
      return;
    }

    // ── IDENTITY NOT VERIFIED ─────────────────
    if (!verification.isVerified) {
      const attemptsRemaining = Math.max(0, 3 - verification.attemptCount);
      const canRetry = verification.status === 'rejected' && attemptsRemaining > 0;

      const statusMessages: Record<string, any> = {
        pending: {
          title: 'Verification Pending ⏳',
          body: 'Your verification is being processed. This usually takes less than 2 minutes.',
          buttonLabel: 'Check Status',
          buttonUrl: '/kyc/status',
        },
        under_review: {
          title: 'Under Review 🔍',
          body: 'Our team is reviewing your documents. You will receive a notification once complete.',
          buttonLabel: 'Check Status',
          buttonUrl: '/kyc/status',
        },
        rejected: {
          title: 'Verification Failed ❌',
          body: canRetry
            ? `${verification.rejectionReason || 'Verification failed'}. You have ${attemptsRemaining} attempt${attemptsRemaining > 1 ? 's' : ''} remaining.`
            : 'Maximum attempts reached. Please contact support@plz.app',
          buttonLabel: canRetry ? 'Try Again' : 'Contact Support',
          buttonUrl: canRetry ? '/kyc/update' : 'mailto:support@plz.app',
        },
      };

      res.status(403).json({
        success: false,
        message: 'Identity verification required',
        data: {
          kycRequired: true,
          phoneVerified: true,
          identityVerified: false,
          nextStep: canRetry ? 'retry_verification' : 'await_verification',
          status: verification.status,
          attemptsRemaining,
          canRetry,
          steps: [
            { step: 1, label: 'Verify Phone Number', completed: true },
            { step: 2, label: 'Verify Identity', completed: false },
          ],
          ui: statusMessages[verification.status] || statusMessages.pending,
        },
      });
      return;
    }

    // ── FULLY VERIFIED ✅ ─────────────────────
    next();
  } catch (error: any) {
    logger.error('KYC middleware error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to check KYC status' });
  }
};
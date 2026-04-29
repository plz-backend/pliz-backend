import axios from 'axios';
import prisma from '../../../config/database';
import logger from '../../../config/logger';
import { KYCDocumentUploadService } from './document-upload.service';

const PREMBLY_BASE_URL = 'https://api.prembly.com';
const MIN_LIVENESS_SCORE = 0.7;

const getHeaders = () => ({
  'x-api-key': process.env.PREMBLY_API_KEY!,
  'app-id': process.env.PREMBLY_APP_ID!,
  'Content-Type': 'application/json',
});

export class FaceLivenessService {

  // ============================================
  // VERIFY FACE LIVENESS
  // ============================================
  static async verifyFaceLiveness(
    userId: string,
    imageBase64: string
  ): Promise<{ passed: boolean; score: number; error?: string }> {
    try {
      const verification = await prisma.userVerification.findUnique({
        where: { userId },
        select: {
          phoneVerified: true,
          documentVerified: true,
          isVerified: true,
        },
      });

      if (!verification) {
        throw new Error('Please start KYC verification first.');
      }
      if (!verification.phoneVerified) {
        throw new Error('Please verify your phone number first.');
      }
      if (!verification.documentVerified) {
        throw new Error('Please upload your document first.');
      }
      if (verification.isVerified) {
        throw new Error('Your identity is already verified.');
      }

      // Dev mode — skip actual API call
      if (process.env.NODE_ENV === 'development') {
        logger.info('DEV MODE — Face liveness skipped');

        const faceBuffer = Buffer.from(imageBase64, 'base64');
        const faceUrl = await KYCDocumentUploadService.uploadDocument(
          userId,
          faceBuffer,
          'image/jpeg',
          'face_liveness'
        );

        await prisma.userVerification.update({
          where: { userId },
          data: {
            faceLivenessUrl: faceUrl,
            faceLivenessPassed: true,
            faceLivenessScore: 0.99,
            faceLivenessPassedAt: new Date(),
            status: 'liveness_passed',
          },
        });

        return { passed: true, score: 0.99 };
      }

      // Call Prembly face liveness API
      const response = await axios.post(
        `${PREMBLY_BASE_URL}/identitypass/verification/face_liveness`,
        { image: imageBase64 },
        { headers: getHeaders(), timeout: 30000 }
      );

      const result = response.data;
      const score = result.face_data?.confidence_value || 0;
      const passed = result.status === true && score >= MIN_LIVENESS_SCORE;

      if (!passed) {
        logger.warn('Face liveness failed', { userId, score });
        return {
          passed: false,
          score,
          error: score < MIN_LIVENESS_SCORE
            ? `Liveness score too low (${Math.round(score * 100)}%). Please ensure good lighting and try again.`
            : result.detail || 'Face liveness check failed. Please try again.',
        };
      }

      // Upload selfie to Supabase
      const faceBuffer = Buffer.from(imageBase64, 'base64');
      const faceUrl = await KYCDocumentUploadService.uploadDocument(
        userId,
        faceBuffer,
        'image/jpeg',
        'face_liveness'
      );

      await prisma.userVerification.update({
        where: { userId },
        data: {
          faceLivenessUrl: faceUrl,
          faceLivenessPassed: true,
          faceLivenessScore: score,
          faceLivenessPassedAt: new Date(),
          status: 'liveness_passed',
        },
      });

      logger.info('Face liveness passed', { userId, score });
      return { passed: true, score };
    } catch (error: any) {
      logger.error('Face liveness failed', { error: error.message, userId });
      throw error;
    }
  }
}
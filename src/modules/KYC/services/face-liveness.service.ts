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

const shouldSkipPrembly = () =>
  process.env.PREMBLY_SKIP_VERIFICATION === 'true';

function normalizeBase64Image(image: string): string {
  const trimmed = image.trim();
  const commaIndex = trimmed.indexOf(',');
  if (trimmed.startsWith('data:') && commaIndex !== -1) {
    return trimmed.slice(commaIndex + 1);
  }
  return trimmed;
}

function extractLivenessScore(result: Record<string, any>): number {
  const raw =
    result.confidence ??
    result.confidence_in_percentage ??
    result.face_data?.confidence_value ??
    result.face_data?.confidence;

  if (typeof raw !== 'number' || Number.isNaN(raw)) return 0;
  return raw > 1 ? raw / 100 : raw;
}

function isPremblySuccess(result: Record<string, any>): boolean {
  return result.status === true || result.response_code === '00';
}

export class FaceLivenessService {

  // ============================================
  // VERIFY FACE LIVENESS (passport flow — stores selfie for face match)
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
          verificationType: true,
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
      if (verification.verificationType === 'nin') {
        throw new Error(
          'Face liveness is not required for NIN verification. Submit your verification instead.'
        );
      }

      const normalizedBase64 = normalizeBase64Image(imageBase64);
      if (!normalizedBase64) {
        throw new Error('Selfie image is empty. Please take a photo and try again.');
      }

      let score = 0.99;

      if (!shouldSkipPrembly()) {
        logger.info('Calling Prembly face liveness API', { userId });

        const response = await axios.post(
          `${PREMBLY_BASE_URL}/verification/biometrics/face/liveliness_check`,
          { image: normalizedBase64 },
          { headers: getHeaders(), timeout: 30000 }
        );

        const result = response.data ?? {};
        score = extractLivenessScore(result);
        const passed = isPremblySuccess(result) && score >= MIN_LIVENESS_SCORE;

        if (!passed) {
          logger.warn('Face liveness failed', { userId, score });
          return {
            passed: false,
            score,
            error:
              score > 0 && score < MIN_LIVENESS_SCORE
                ? `Liveness score too low (${Math.round(score * 100)}%). Please ensure good lighting and try again.`
                : result.detail ||
                  result.message ||
                  'Face liveness check failed. Please try again.',
          };
        }
      } else {
        logger.info('PREMBLY_SKIP_VERIFICATION — face liveness skipped', { userId });
      }

      const faceBuffer = Buffer.from(normalizedBase64, 'base64');
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
      if (axios.isAxiosError(error)) {
        const detail =
          error.response?.data?.detail ??
          error.response?.data?.message ??
          error.message;
        logger.error('Face liveness API failed', {
          userId,
          status: error.response?.status,
          detail,
        });
        throw new Error(
          typeof detail === 'string'
            ? detail
            : 'Face liveness check failed. Please try again.'
        );
      }

      logger.error('Face liveness failed', { error: error?.message, userId });
      throw error;
    }
  }
}

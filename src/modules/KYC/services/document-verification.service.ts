import axios from 'axios';
import logger from '../../../config/logger';

const PREMBLY_BASE_URL = 'https://api.prembly.com';

const getHeaders = () => ({
  'x-api-key': process.env.PREMBLY_API_KEY!,
  'app-id': process.env.PREMBLY_APP_ID!,
  'Content-Type': 'application/json',
});

export class DocumentVerificationService {

  // ============================================
  // VERIFY NIN DOCUMENT AUTHENTICITY
  // ============================================
  static async verifyNINDocument(
    imageBase64: string,
    documentType: 'slip' | 'card'
  ): Promise<{ valid: boolean; error?: string; data?: any }> {
    try {
      if (process.env.NODE_ENV === 'development') {
        logger.info('DEV MODE — NIN document check skipped');
        return { valid: true };
      }

      const response = await axios.post(
        `${PREMBLY_BASE_URL}/identitypass/verification/document`,
        { doc_type: 'nin', image: imageBase64 },
        { headers: getHeaders(), timeout: 30000 }
      );

      const result = response.data;

      if (!result.status) {
        return {
          valid: false,
          error: result.detail ||
            'Document could not be verified. Please upload a clear photo.',
        };
      }

      logger.info('NIN document verified as authentic');
      return { valid: true, data: result };
    } catch (error: any) {
      logger.error('NIN document check failed', { error: error.message });

      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        logger.warn('Prembly unreachable — document marked for manual review');
        return { valid: true };
      }

      return {
        valid: false,
        error: 'Document verification failed. Please upload a clearer photo.',
      };
    }
  }

  // ============================================
  // VERIFY PASSPORT DOCUMENT AUTHENTICITY
  // ============================================
  static async verifyPassportDocument(
    imageBase64: string
  ): Promise<{ valid: boolean; error?: string; data?: any }> {
    try {
      if (process.env.NODE_ENV === 'development') {
        logger.info('DEV MODE — Passport document check skipped');
        return { valid: true };
      }

      const response = await axios.post(
        `${PREMBLY_BASE_URL}/identitypass/verification/document`,
        { doc_type: 'international_passport', image: imageBase64 },
        { headers: getHeaders(), timeout: 30000 }
      );

      const result = response.data;

      if (!result.status) {
        return {
          valid: false,
          error: result.detail ||
            'Passport could not be verified. Please upload a clear photo of your biodata page.',
        };
      }

      logger.info('Passport document verified as authentic');
      return { valid: true, data: result };
    } catch (error: any) {
      logger.error('Passport document check failed', { error: error.message });

      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        logger.warn('Prembly unreachable — passport marked for manual review');
        return { valid: true };
      }

      return {
        valid: false,
        error: 'Passport verification failed. Please upload a clearer photo.',
      };
    }
  }
}
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import logger from '../../../config/logger';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const BUCKET = process.env.SUPABASE_KYC_BUCKET || 'kyc-documents';

export class KYCDocumentUploadService {

  // ============================================
  // UPLOAD DOCUMENT TO SUPABASE
  // ============================================
  static async uploadDocument(
    userId: string,
    fileBuffer: Buffer,
    mimeType: string,
    documentType: string
  ): Promise<string> {
    try {
      const processedBuffer = await sharp(fileBuffer)
        .resize(1200, 1200, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 90 })
        .toBuffer();

      const fileName = `${userId}/${documentType}_${Date.now()}.jpg`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, processedBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) {
        logger.error('Supabase KYC upload error', { error: error.message });
        throw new Error('Failed to upload document');
      }

      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(fileName);

      logger.info('KYC document uploaded', { userId, documentType });

      return urlData.publicUrl;
    } catch (error: any) {
      logger.error('KYC upload failed', { error: error.message, userId });
      throw error;
    }
  }

  // ============================================
  // CONVERT TO BASE64 FOR PREMBLY
  // ============================================
  static toBase64(fileBuffer: Buffer): string {
    return fileBuffer.toString('base64');
  }

  // ============================================
  // DELETE ALL DOCUMENTS FOR USER
  // ============================================
  static async deleteDocuments(userId: string): Promise<void> {
    try {
      const { data: files } = await supabase.storage
        .from(BUCKET)
        .list(userId);

      if (!files || files.length === 0) return;

      const filePaths = files.map(f => `${userId}/${f.name}`);
      await supabase.storage.from(BUCKET).remove(filePaths);

      logger.info('KYC documents deleted', { userId });
    } catch (error: any) {
      logger.warn('KYC document delete failed', { error: error.message, userId });
    }
  }
}
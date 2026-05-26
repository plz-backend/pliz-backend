import sharp from 'sharp';
import { getSupabaseClient } from '../../../config/supabase';
import logger from '../../../config/logger';

const BUCKET = process.env.SUPABASE_KYC_BUCKET || 'kyc-documents';
const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour for admin review

export class KYCDocumentUploadService {

  // ============================================
  // UPLOAD DOCUMENT TO SUPABASE (private bucket)
  // Returns storage object path — not a public URL.
  // ============================================
  static async uploadDocument(
    userId: string,
    fileBuffer: Buffer,
    mimeType: string,
    documentType: string
  ): Promise<string> {
    try {
      const supabase = getSupabaseClient();
      const processedBuffer = await sharp(fileBuffer)
        .resize(1200, 1200, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 90 })
        .toBuffer();

      const fileName = `${userId}/${documentType}_${Date.now()}.jpg`;

      const uploadResult = await supabase.storage
        .from(BUCKET)
        .upload(fileName, processedBuffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (!uploadResult || typeof uploadResult !== 'object') {
        throw new Error('Storage upload returned an invalid response');
      }

      const { error: uploadError } = uploadResult;

      if (uploadError) {
        logger.error('Supabase KYC upload error', { error: uploadError.message });
        throw new Error('Failed to upload document');
      }

      logger.info('KYC document uploaded', { userId, documentType });

      return fileName;
    } catch (error: any) {
      logger.error('KYC upload failed', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Resolve a stored value (legacy public URL or object path) to a storage path.
   */
  static extractStoragePath(stored: string | null | undefined): string | null {
    if (!stored?.trim()) return null;
    const value = stored.trim();
    if (!value.includes('://')) return value;

    const publicMarker = `/storage/v1/object/public/${BUCKET}/`;
    const signedMarker = `/storage/v1/object/sign/${BUCKET}/`;
    const privateMarker = `/storage/v1/object/${BUCKET}/`;

    for (const marker of [publicMarker, signedMarker, privateMarker]) {
      const index = value.indexOf(marker);
      if (index !== -1) {
        return decodeURIComponent(value.slice(index + marker.length).split('?')[0]);
      }
    }

    return value;
  }

  static async createSignedUrl(
    stored: string | null | undefined,
    expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS
  ): Promise<string | null> {
    const path = this.extractStoragePath(stored);
    if (!path) return null;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data?.signedUrl) {
      logger.warn('Failed to create signed KYC URL', {
        path,
        error: error?.message,
      });
      return null;
    }

    return data.signedUrl;
  }

  static async downloadAsBase64(stored: string | null | undefined): Promise<string | null> {
    const path = this.extractStoragePath(stored);
    if (!path) return null;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage.from(BUCKET).download(path);

    if (error || !data) {
      logger.warn('Failed to download KYC document', {
        path,
        error: error?.message,
      });
      return null;
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    return buffer.toString('base64');
  }

  // ============================================
  // DELETE ALL DOCUMENTS FOR USER
  // ============================================
  static async deleteDocuments(userId: string): Promise<void> {
    try {
      const supabase = getSupabaseClient();
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

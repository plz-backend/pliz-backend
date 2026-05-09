import { getSupabaseClient } from '../../../config/supabase';
import logger from '../../../config/logger';

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'profile-pictures';

export class SupabaseStorageService {

  // ============================================
  // UPLOAD IMAGE TO SUPABASE
  // ============================================
  static async uploadImage(
    userId: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<string> {
    try {
      const supabase = getSupabaseClient();
      const fileName = `${userId}/avatar_${Date.now()}.jpg`;

      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (error) {
        logger.error('Supabase upload error', { error: error.message });
        throw new Error('Failed to upload image to storage');
      }

      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(fileName);

      logger.info('Image uploaded to Supabase', { userId, fileName });

      return urlData.publicUrl;
    } catch (error: any) {
      logger.error('Supabase upload failed', { error: error.message, userId });
      throw error;
    }
  }

  static async getDisplayUrl(avatarUrl: string): Promise<string> {
    const objectPath = this.extractObjectPath(avatarUrl);
    if (!objectPath) return avatarUrl;

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(objectPath, 60 * 60 * 24 * 7);

      if (error || !data?.signedUrl) {
        logger.warn('Supabase signed URL warning', { error: error?.message });
        return avatarUrl;
      }

      return data.signedUrl;
    } catch (error: any) {
      logger.warn('Supabase signed URL failed', { error: error.message });
      return avatarUrl;
    }
  }

  // ============================================
  // DELETE IMAGE FROM SUPABASE
  // ============================================
  static async deleteImage(userId: string): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      const { data: files, error: listError } = await supabase.storage
        .from(BUCKET)
        .list(userId);

      if (listError || !files || files.length === 0) return;

      const filePaths = files.map(f => `${userId}/${f.name}`);

      const { error: deleteError } = await supabase.storage
        .from(BUCKET)
        .remove(filePaths);

      if (deleteError) {
        logger.warn('Supabase delete warning', { error: deleteError.message });
      }

      logger.info('Image deleted from Supabase', { userId });
    } catch (error: any) {
      logger.warn('Supabase delete failed — continuing', {
        error: error.message,
        userId,
      });
    }
  }

  private static extractObjectPath(url: string): string | null {
    const publicMarker = `/object/public/${BUCKET}/`;
    const signedMarker = `/object/sign/${BUCKET}/`;
    const marker = url.includes(publicMarker)
      ? publicMarker
      : url.includes(signedMarker)
        ? signedMarker
        : null;

    if (!marker) return null;

    const [, pathWithQuery] = url.split(marker);
    return decodeURIComponent((pathWithQuery || '').split('?')[0]);
  }
}

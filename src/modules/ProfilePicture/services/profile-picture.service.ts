import sharp from 'sharp';
import prisma from '../../../config/database';
import logger from '../../../config/logger';
import { SupabaseStorageService } from './supabase.service';
import {
  IProfilePictureResponse,
  IAvatarOptionsResponse,
  AVATAR_COLORS,
  LIBRARY_AVATARS,
  AvatarType,
} from '../types/profile-picture.interface';

export class ProfilePictureService {

  // ============================================
  // UPLOAD PROFILE PICTURE
  // Crops to 400x400 square before uploading
  // ============================================
  static async uploadPicture(
    userId: string,
    fileBuffer: Buffer,
    mimeType: string
  ): Promise<IProfilePictureResponse> {
    try {
      // Crop to square + resize to 400x400 + compress
      const processedBuffer = await sharp(fileBuffer)
        .resize(400, 400, {
          fit: 'cover',
          position: 'centre',
        })
        .jpeg({ quality: 85 })
        .toBuffer();

      // Delete old photo if exists
      await SupabaseStorageService.deleteImage(userId);

      // Upload to Supabase
      const avatarUrl = await SupabaseStorageService.uploadImage(
        userId,
        processedBuffer,
        'image/jpeg'
      );

      // Upsert UserAvatar record
      await prisma.userAvatar.upsert({
        where: { userId },
        create: {
          userId,
          avatarType: 'photo',
          avatarUrl,
          avatarColor: null,
          avatarLibraryId: null,
        },
        update: {
          avatarType: 'photo',
          avatarUrl,
          avatarColor: null,
          avatarLibraryId: null,
        },
      });

      logger.info('Profile picture uploaded', { userId });

      return await this.buildResponse({
        userId,
        avatarType: 'photo',
        avatarUrl,
        avatarColor: null,
        avatarLibraryId: null,
      });
    } catch (error: any) {
      logger.error('Failed to upload profile picture', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  // ============================================
  // REMOVE PROFILE PICTURE
  // Goes back to initials avatar
  // ============================================
  static async removePicture(userId: string): Promise<IProfilePictureResponse> {
    try {
      // Delete from Supabase
      await SupabaseStorageService.deleteImage(userId);

      // Pick random color for initials
      const randomColor = AVATAR_COLORS[
        Math.floor(Math.random() * AVATAR_COLORS.length)
      ];

      // Update avatar record
      await prisma.userAvatar.upsert({
        where: { userId },
        create: {
          userId,
          avatarType: 'initials',
          avatarUrl: null,
          avatarColor: randomColor,
          avatarLibraryId: null,
        },
        update: {
          avatarType: 'initials',
          avatarUrl: null,
          avatarColor: randomColor,
          avatarLibraryId: null,
        },
      });

      // Get user initials
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: { select: { firstName: true, lastName: true } },
        },
      });

      logger.info('Profile picture removed', { userId });

      return await this.buildResponse({
        userId,
        avatarType: 'initials',
        avatarUrl: null,
        avatarColor: randomColor,
        avatarLibraryId: null,
        firstName: user?.profile?.firstName,
        lastName: user?.profile?.lastName,
      });
    } catch (error: any) {
      logger.error('Failed to remove profile picture', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  // ============================================
  // SET INITIALS AVATAR
  // User picks a background color
  // ============================================
  static async setInitialsAvatar(
    userId: string,
    color: string
  ): Promise<IProfilePictureResponse> {
    try {
      if (!AVATAR_COLORS.includes(color as any)) {
        throw new Error('Invalid color selected');
      }

      // Delete photo if exists
      await SupabaseStorageService.deleteImage(userId);

      await prisma.userAvatar.upsert({
        where: { userId },
        create: {
          userId,
          avatarType: 'initials',
          avatarUrl: null,
          avatarColor: color,
          avatarLibraryId: null,
        },
        update: {
          avatarType: 'initials',
          avatarUrl: null,
          avatarColor: color,
          avatarLibraryId: null,
        },
      });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          profile: { select: { firstName: true, lastName: true } },
        },
      });

      logger.info('Initials avatar set', { userId, color });

      return await this.buildResponse({
        userId,
        avatarType: 'initials',
        avatarUrl: null,
        avatarColor: color,
        avatarLibraryId: null,
        firstName: user?.profile?.firstName,
        lastName: user?.profile?.lastName,
      });
    } catch (error: any) {
      logger.error('Failed to set initials avatar', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  // ============================================
  // SET LIBRARY AVATAR
  // User picks from pre-made avatars
  // ============================================
  static async setLibraryAvatar(
    userId: string,
    avatarId: string
  ): Promise<IProfilePictureResponse> {
    try {
      const avatar = LIBRARY_AVATARS.find(a => a.id === avatarId);
      if (!avatar) {
        throw new Error('Invalid avatar selected');
      }

      // Delete photo if exists
      await SupabaseStorageService.deleteImage(userId);

      await prisma.userAvatar.upsert({
        where: { userId },
        create: {
          userId,
          avatarType: 'library',
          avatarUrl: avatar.url,
          avatarColor: null,
          avatarLibraryId: avatarId,
        },
        update: {
          avatarType: 'library',
          avatarUrl: avatar.url,
          avatarColor: null,
          avatarLibraryId: avatarId,
        },
      });

      logger.info('Library avatar set', { userId, avatarId });

      return await this.buildResponse({
        userId,
        avatarType: 'library',
        avatarUrl: avatar.url,
        avatarColor: null,
        avatarLibraryId: avatarId,
      });
    } catch (error: any) {
      logger.error('Failed to set library avatar', {
        error: error.message,
        userId,
      });
      throw error;
    }
  }

  // ============================================
  // GET CURRENT AVATAR
  // ============================================
  static async getAvatar(userId: string): Promise<IProfilePictureResponse> {
    try {
      const [avatar, user] = await Promise.all([
        prisma.userAvatar.findUnique({ where: { userId } }),
        prisma.user.findUnique({
          where: { id: userId },
          include: {
            profile: { select: { firstName: true, lastName: true } },
          },
        }),
      ]);

      if (!user) throw new Error('User not found');

      // No avatar record yet — return default initials
      if (!avatar) {
        return await this.buildResponse({
          userId,
          avatarType: 'initials',
          avatarUrl: null,
          avatarColor: '#FF5733',
          avatarLibraryId: null,
          firstName: user.profile?.firstName,
          lastName: user.profile?.lastName,
        });
      }

      return await this.buildResponse({
        userId,
        avatarType: avatar.avatarType as AvatarType,
        avatarUrl: avatar.avatarUrl,
        avatarColor: avatar.avatarColor,
        avatarLibraryId: avatar.avatarLibraryId,
        firstName: user.profile?.firstName,
        lastName: user.profile?.lastName,
      });
    } catch (error: any) {
      logger.error('Failed to get avatar', { error: error.message, userId });
      throw error;
    }
  }

  // ============================================
  // GET AVATAR OPTIONS
  // Returns colors + library avatars for picker
  // ============================================
  static getAvatarOptions(): IAvatarOptionsResponse {
    return {
      colors: AVATAR_COLORS,
      libraryAvatars: LIBRARY_AVATARS,
    };
  }

  // ============================================
  // BUILD RESPONSE
  // Always includes displayUrl
  // ============================================
  private static async buildResponse(data: {
    userId: string;
    avatarType: AvatarType;
    avatarUrl: string | null;
    avatarColor: string | null;
    avatarLibraryId: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }): Promise<IProfilePictureResponse> {
    let displayUrl: string;

    if (data.avatarType === 'photo' && data.avatarUrl) {
      displayUrl = await SupabaseStorageService.getDisplayUrl(data.avatarUrl);
    } else if (data.avatarType === 'library' && data.avatarUrl) {
      displayUrl = data.avatarUrl;
    } else {
      // Generate initials avatar using DiceBear
      const initials = this.getInitials(data.firstName, data.lastName);
      const color = (data.avatarColor || '#FF5733').replace('#', '');
      displayUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${initials}&backgroundColor=${color}&fontSize=40`;
    }

    return {
      userId: data.userId,
      avatarType: data.avatarType,
      avatarUrl: data.avatarUrl,
      avatarColor: data.avatarColor,
      avatarLibraryId: data.avatarLibraryId,
      displayUrl,
    };
  }

  // ============================================
  // GET INITIALS FROM NAME
  // ============================================
  private static getInitials(
    firstName?: string | null,
    lastName?: string | null
  ): string {
    const first = firstName?.charAt(0).toUpperCase() || 'P';
    const last = lastName?.charAt(0).toUpperCase() || 'L';
    return `${first}${last}`;
  }
}

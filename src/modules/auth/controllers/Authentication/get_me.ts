import { Request, Response } from 'express';
import prisma from '../../../../config/database';
import {
  IUserResponse,
  IUserStatsSummary,
  IApiResponse,
} from '../../types/user.interface';
import logger from '../../../../config/logger';
import { buildStaffAuthFields } from '../../../admin/utils/admin-user-response';

function initialsFromProfile(
  profile: { firstName?: string | null; lastName?: string | null } | null | undefined
): string {
  const first = profile?.firstName?.charAt(0).toUpperCase() || 'P';
  const last = profile?.lastName?.charAt(0).toUpperCase() || 'L';
  return `${first}${last}`;
}

function buildAvatarDisplayUrl(
  avatar: {
    avatarType: string;
    avatarUrl: string | null;
    avatarColor: string | null;
    avatarLibraryId: string | null;
  } | null,
  profile: { firstName?: string | null; lastName?: string | null } | null | undefined
): string {
  if ((avatar?.avatarType === 'photo' || avatar?.avatarType === 'library') && avatar.avatarUrl) {
    return avatar.avatarUrl;
  }

  const initials = initialsFromProfile(profile);
  const color = (avatar?.avatarColor || '#FF5733').replace('#', '');
  return `https://api.dicebear.com/7.x/initials/svg?seed=${initials}&backgroundColor=${color}&fontSize=40`;
}

/**
 * Helper to send response
 */
const sendResponse = <T = any>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user with profile
 * @access  Private
 */
export const getMe = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // FIXED: Use req.user?.userId (properly typed)
    const userId = req.user?.userId;

    if (!userId) {
      logger.warn('Get current user: No user ID in request');
      const response: IApiResponse = {
        success: false,
        message: 'User not authenticated',
      };
      sendResponse(res, 401, response);
      return;
    }

    logger.info('Get current user request', { userId });

    // Get user with profile + aggregate stats from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        stats: true,
        verification: {
          select: {
            verificationType: true,
            status: true,
            isVerified: true,
            phoneVerified: true,
            documentVerified: true,
            verifiedAt: true,
            rejectionReason: true,
            attemptCount: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!user) {
      logger.warn('Get current user: User not found', { userId });
      const response: IApiResponse = {
        success: false,
        message: 'User not found',
      };
      sendResponse(res, 404, response);
      return;
    }
    const weekAgo = new Date();
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);

    const [donationRows, weeklyDonationRows] = await Promise.all([
      prisma.donation.findMany({
        where: { donorId: userId, status: 'success' },
        distinct: ['begId'],
        select: {
          begId: true,
          beg: { select: { userId: true } },
        },
      }),
      prisma.donation.findMany({
        where: {
          donorId: userId,
          status: 'success',
          createdAt: { gte: weekAgo },
        },
        distinct: ['begId'],
        select: {
          begId: true,
          beg: { select: { userId: true } },
        },
      }),
    ]);

    const peopleHelped = new Set(donationRows.map((r) => r.beg.userId)).size;
    const peopleHelpedThisWeek = new Set(
      weeklyDonationRows.map((r) => r.beg.userId)
    ).size;

    // Get stats summary
    const statsSummary: IUserStatsSummary = user.stats
      ? {
          totalDonated: parseFloat(user.stats.totalDonated.toString()),
          totalReceived: parseFloat(user.stats.totalReceived.toString()),
          requestsCount: user.stats.requestsCount,
          peopleHelped,
          peopleHelpedThisWeek,
        }
      : {
          totalDonated: 0,
          totalReceived: 0,
          requestsCount: 0,
          peopleHelped,
          peopleHelpedThisWeek,
        };

    const legacyAvatar = user.avatar
      ? {
          avatarType: 'photo',
          avatarUrl: user.avatar,
          avatarColor: null,
          avatarLibraryId: null,
        }
      : null;

    // Prepare complete user response (excluding password)
    const userResponse: IUserResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,  // Include role
      isEmailVerified: user.isEmailVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      isProfileComplete: user.isProfileComplete,
      isSuspended: user.isSuspended,  // Include suspension status
      isUnderInvestigation: user.isUnderInvestigation,  // Include investigation status
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      ...buildStaffAuthFields(user),
      profile: user.profile || null,  // Include profile data
      stats: statsSummary, // Include stats data
      verification: user.verification
        ? {
            verificationType: user.verification.verificationType,
            status: user.verification.status,
            isVerified: user.verification.isVerified,
            phoneVerified: user.verification.phoneVerified,
            documentVerified: user.verification.documentVerified,
            faceLivenessPassed: false,
            verifiedAt: user.verification.verifiedAt,
            rejectionReason: user.verification.rejectionReason,
            attemptCount: user.verification.attemptCount,
            updatedAt: user.verification.updatedAt,
          }
        : null,
      avatar: {
        avatarType: legacyAvatar?.avatarType || 'initials',
        avatarUrl: legacyAvatar?.avatarUrl || null,
        avatarColor: legacyAvatar?.avatarColor || '#FF5733',
        avatarLibraryId: legacyAvatar?.avatarLibraryId || null,
        displayUrl: buildAvatarDisplayUrl(legacyAvatar, user.profile),
      },
    };

    logger.info('Current user retrieved successfully', { userId: user.id });

    const response: IApiResponse<{ user: IUserResponse }> = {
      success: true,
      message: 'User retrieved successfully',
      data: { user: userResponse },
    };
    sendResponse(res, 200, response);
  } catch (error: any) {
    logger.error('Get current user error', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
    });

    const response: IApiResponse = {
      success: false,
      message: 'Failed to retrieve user information',
    };
    sendResponse(res, 500, response);
  }
};

import { Request, Response } from 'express';
import prisma from '../../../../config/database';
import { IApiResponse } from '../../types/user.interface';
import logger from '../../../../config/logger';
import { ProfilePictureService } from '../../../ProfilePicture/services/profile-picture.service';

const sendResponse = <T = unknown>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   GET /api/users/:userId/public-profile
 * @desc    Public member profile (no email/phone); blocked when user is in anonymous mode
 * @access  Private (authenticated app users)
 */
export const getPublicProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = Array.isArray(req.params.userId)
      ? req.params.userId[0]
      : req.params.userId;

    if (!userId) {
      sendResponse(res, 400, { success: false, message: 'User ID is required' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        role: true,
        isSuspended: true,
        profile: {
          select: {
            firstName: true,
            lastName: true,
            displayName: true,
            city: true,
            state: true,
            isAnonymous: true,
          },
        },
        stats: {
          select: {
            totalDonated: true,
            requestsCount: true,
            peopleHelped: true,
          },
        },
        verification: {
          select: {
            isVerified: true,
          },
        },
      },
    });

    if (!user || !user.profile) {
      sendResponse(res, 404, { success: false, message: 'Profile not found' });
      return;
    }

    if (user.isSuspended) {
      sendResponse(res, 404, { success: false, message: 'Profile not found' });
      return;
    }

    if (user.profile.isAnonymous) {
      sendResponse(res, 403, {
        success: false,
        message: 'This member keeps their profile private.',
      });
      return;
    }

    const peopleHelped = user.stats?.peopleHelped ?? 0;

    const avatar = await ProfilePictureService.getAvatar(userId);

    const firstName = user.profile.firstName?.trim() ?? '';
    const lastName = user.profile.lastName?.trim() ?? '';
    const fullName =
      `${firstName} ${lastName}`.trim() ||
      user.profile.displayName?.trim() ||
      user.username;

    sendResponse(res, 200, {
      success: true,
      message: 'Public profile retrieved successfully',
      data: {
        profile: {
          id: user.id,
          fullName,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          city: user.profile.city?.trim() || undefined,
          state: user.profile.state?.trim() || undefined,
          role: user.role,
          isVerified: Boolean(user.verification?.isVerified),
          stats: {
            totalDonated: user.stats
              ? parseFloat(user.stats.totalDonated.toString())
              : 0,
            peopleHelped,
            requestsCount: user.stats?.requestsCount ?? 0,
          },
          avatar: {
            displayUrl: avatar.displayUrl,
            avatarColor: avatar.avatarColor,
            avatarType: avatar.avatarType,
          },
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Get public profile error', { error: message });
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve profile',
    });
  }
};

import { Request, Response } from 'express';
import prisma from '../../../../config/database';
import {
  IUserResponse,
  IUserStatsSummary,
  IApiResponse,
} from '../../types/user.interface';
import logger from '../../../../config/logger';

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
      profile: user.profile || null,  // Include profile data
      stats: statsSummary, // Include stats data
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
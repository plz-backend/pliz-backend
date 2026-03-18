import { Request, Response } from 'express';
import prisma from '../../../../config/database';
import { IApiResponse } from '../../types/user.interface';
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
 * @route   GET /api/auth/profile
 * @desc    Get user profile
 * @access  Private
 */
export const getProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    logger.info('Get profile request', { userId });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        isEmailVerified: true,
        isProfileComplete: true,
        createdAt: true,
        profile: {
          select: {
            firstName: true,
            middleName: true,
            lastName: true,
            phoneNumber: true,
            displayName: true,
            isAnonymous: true,
            agreeToTerms: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      const response: IApiResponse = {
        success: false,
        message: 'User not found',
      };
      sendResponse(res, 404, response);
      return;
    }

    const response: IApiResponse = {
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
          isProfileComplete: user.isProfileComplete,
          profile: user.profile,
        },
      },
    };

    sendResponse(res, 200, response);
  } catch (error: any) {
    logger.error('Get profile error', {
      error: error.message,
      stack: error.stack,
    });

    const response: IApiResponse = {
      success: false,
      message: 'Failed to retrieve profile',
    };

    sendResponse(res, 500, response);
  }
};
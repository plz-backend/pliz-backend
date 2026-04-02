import { Request, Response } from 'express';
import prisma from '../../../../config/database';
import { IApiResponse } from '../../types/user.interface';
import logger from '../../../../config/logger';

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
            // Step 1: Personal Identity
            firstName: true,
            middleName: true,
            lastName: true,
            displayName: true,
            dateOfBirth: true,
            gender: true,
            // Step 2: Contact
            phoneNumber: true,
            // Step 3: Location
            state: true,
            city: true,
            address: true,       // ← added
            // Step 4: Privacy
            isAnonymous: true,
            // Step 5: Legal
            agreeToTerms: true,
            // System
            createdAt: true,
            updatedAt: true,     // ← added
          },
        },
      },
    });

    if (!user) {
      sendResponse(res, 404, { success: false, message: 'User not found' });
      return;
    }

    sendResponse(res, 200, {
      success: true,
      message: 'Profile retrieved successfully',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          isEmailVerified: user.isEmailVerified,
          isProfileComplete: user.isProfileComplete,
          createdAt: user.createdAt,
          profile: user.profile,
        },
      },
    });
  } catch (error: any) {
    logger.error('Get profile error', {
      error: error.message,
      stack: error.stack,
    });
    sendResponse(res, 500, { success: false, message: 'Failed to retrieve profile' });
  }
};
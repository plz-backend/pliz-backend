import { Request, Response } from 'express';
import prisma from '../../../../config/database';
// import { TrustScoreService } from '../../../../../src/services/trust_score.service';
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
 * @route   POST /api/auth/profile/complete
 * @desc    Complete user profile (Step 3: After email verification)
 * @access  Private
 */
export const completeProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { firstName, middleName, lastName, phoneNumber, agreeToTerms, displayName, isAnonymous } = req.body;

    logger.info('Complete profile request', { userId });

    // Validate user exists and email is verified
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      const response: IApiResponse = {
        success: false,
        message: 'User not found',
      };
      sendResponse(res, 404, response);
      return;
    }

    if (!user.isEmailVerified) {
      const response: IApiResponse = {
        success: false,
        message: 'Please verify your email before completing your profile',
      };
      sendResponse(res, 403, response);
      return;
    }

    if (user.profile) {
      const response: IApiResponse = {
        success: false,
        message: 'Profile already completed. Use update profile endpoint instead.',
      };
      sendResponse(res, 400, response);
      return;
    }

    // Validate required fields
    if (!firstName || !lastName || !phoneNumber || agreeToTerms !== true) {
      const response: IApiResponse = {
        success: false,
        message: 'First name, last name, phone number are required. You must agree to terms.',
      };
      sendResponse(res, 400, response);
      return;
    }

    // Check if phone number is already used
    const existingPhone = await prisma.userProfile.findFirst({
      where: { phoneNumber },
    });

    if (existingPhone) {
      const response: IApiResponse = {
        success: false,
        message: 'Phone number already registered',
      };
      sendResponse(res, 409, response);
      return;
    }

    // Create profile
    const profile = await prisma.userProfile.create({
      data: {
        userId,
        firstName,
        middleName: middleName || null,
        lastName,
        phoneNumber,
        agreeToTerms,
        displayName: displayName || `${firstName} ${lastName}`,
        isAnonymous: isAnonymous || false,
      },
    });

    // Mark user profile as complete
    await prisma.user.update({
      where: { id: userId },
      data: { isProfileComplete: true },
    });

    logger.info('Profile completed successfully', { userId });

    const response: IApiResponse = {
      success: true,
      message: 'Profile completed successfully! You can now start using Pliz.',
      data: {
        profile: {
          firstName: profile.firstName,
          middleName: profile.middleName,
          lastName: profile.lastName,
          phoneNumber: profile.phoneNumber,
          displayName: profile.displayName,
          isAnonymous: profile.isAnonymous,
        },
      },
    };

    sendResponse(res, 201, response);
  } catch (error: any) {
    logger.error('Complete profile error', {
      error: error.message,
      stack: error.stack,
    });

    const response: IApiResponse = {
      success: false,
      message: 'Failed to complete profile',
    };

    sendResponse(res, 500, response);
  }
};
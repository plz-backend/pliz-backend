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
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
export const updateProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const {
      // Step 1: Personal Identity
      firstName,
      middleName,
      lastName,
      displayName,
      dateOfBirth,
      gender,
      // Step 2: Contact
      phoneNumber,
      // Step 3: Location
      state,
      city,
      address,            // ← added
      // Step 4: Privacy
      isAnonymous,
    } = req.body;

    logger.info('Update profile request', { userId });

    // Check if profile exists
    const existingProfile = await prisma.userProfile.findUnique({
      where: { userId },
    });

    if (!existingProfile) {
      sendResponse(res, 404, {
        success: false,
        message: 'Profile not found. Please complete your profile first.',
      });
      return;
    }

    // Validate gender if provided
    if (gender !== undefined && !['male', 'female'].includes(gender)) {
      sendResponse(res, 400, {
        success: false,
        message: 'Gender must be either male or female',
      });
      return;
    }

    // If updating phone number, check if it's already used by someone else
    if (phoneNumber && phoneNumber !== existingProfile.phoneNumber) {
      const existingPhone = await prisma.userProfile.findFirst({
        where: {
          phoneNumber,
          userId: { not: userId },
        },
      });

      if (existingPhone) {
        sendResponse(res, 409, { success: false, message: 'Phone number already registered' });
        return;
      }
    }

    // Update profile
    const profile = await prisma.userProfile.update({
      where: { userId },
      data: {
        // Step 1: Personal Identity
        firstName:   firstName   !== undefined ? firstName   : existingProfile.firstName,
        middleName:  middleName  !== undefined ? middleName  : existingProfile.middleName,
        lastName:    lastName    !== undefined ? lastName    : existingProfile.lastName,
        displayName: displayName !== undefined ? displayName : existingProfile.displayName,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : existingProfile.dateOfBirth,
        gender:      gender      !== undefined ? gender      : existingProfile.gender,
        // Step 2: Contact
        phoneNumber: phoneNumber !== undefined ? phoneNumber : existingProfile.phoneNumber,
        // Step 3: Location
        state:   state   !== undefined ? state   : existingProfile.state,
        city:    city    !== undefined ? city    : existingProfile.city,
        address: address !== undefined ? address : existingProfile.address,  // ← added
        // Step 4: Privacy
        isAnonymous: isAnonymous !== undefined ? isAnonymous : existingProfile.isAnonymous,
      },
    });

    logger.info('Profile updated successfully', { userId });

    sendResponse(res, 200, {
      success: true,
      message: 'Profile updated successfully',
      data: {
        profile: {
          // Step 1: Personal Identity
          firstName: profile.firstName,
          middleName: profile.middleName,
          lastName: profile.lastName,
          displayName: profile.displayName,
          dateOfBirth: profile.dateOfBirth,
          gender: profile.gender,
          // Step 2: Contact
          phoneNumber: profile.phoneNumber,
          // Step 3: Location
          state: profile.state,
          city: profile.city,
          address: profile.address,    // ← added
          // Step 4: Privacy
          isAnonymous: profile.isAnonymous,
          // System
          updatedAt: profile.updatedAt,
        },
      },
    });
  } catch (error: any) {
    logger.error('Update profile error', {
      error: error.message,
      stack: error.stack,
    });
    sendResponse(res, 500, { success: false, message: 'Failed to update profile' });
  }
};
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
 * @route   POST /api/auth/profile/complete
 * @desc    Complete user profile (After email verification)
 * @access  Private
 */
export const completeProfile = async (
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
      address,            // ← added (optional)
      // Step 4: Privacy
      isAnonymous,
      // Step 5: Legal
      agreeToTerms,
    } = req.body;

    logger.info('Complete profile request', { userId });

    // Validate user exists and email is verified
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });

    if (!user) {
      sendResponse(res, 404, { success: false, message: 'User not found' });
      return;
    }

    if (!user.isEmailVerified) {
      sendResponse(res, 403, {
        success: false,
        message: 'Please verify your email before completing your profile',
      });
      return;
    }

    if (user.profile) {
      sendResponse(res, 400, {
        success: false,
        message: 'Profile already completed. Use update profile endpoint instead.',
      });
      return;
    }

    // Validate required fields
    if (
      !firstName ||
      !lastName ||
      !phoneNumber ||
      !dateOfBirth ||
      !gender ||                      // ← added
      !state ||
      !city ||
      agreeToTerms !== true
    ) {
      sendResponse(res, 400, {
        success: false,
        message: 'First name, last name, phone number, date of birth, gender, state and city are required. You must agree to terms.',
      });
      return;
    }

    // Validate gender value
    if (!['male', 'female'].includes(gender)) {
      sendResponse(res, 400, {
        success: false,
        message: 'Gender must be either male or female',
      });
      return;
    }

    // Check if phone number is already used
    const existingPhone = await prisma.userProfile.findFirst({
      where: { phoneNumber },
    });

    if (existingPhone) {
      sendResponse(res, 409, { success: false, message: 'Phone number already registered' });
      return;
    }

    // Create profile
    const profile = await prisma.userProfile.create({
      data: {
        userId,
        // Step 1: Personal Identity
        firstName,
        middleName: middleName || null,
        lastName,
        displayName: displayName || `${firstName} ${lastName}`,
        dateOfBirth: new Date(dateOfBirth),
        gender,
        // Step 2: Contact
        phoneNumber,
        // Step 3: Location
        state,
        city,
        address: address || null,     // ← optional
        // Step 4: Privacy
        isAnonymous: isAnonymous || false,
        // Step 5: Legal
        agreeToTerms,
      },
    });

    // Mark user profile as complete
    await prisma.user.update({
      where: { id: userId },
      data: { isProfileComplete: true },
    });

    logger.info('Profile completed successfully', { userId });

    sendResponse(res, 201, {
      success: true,
      message: 'Profile completed successfully! You can now start using Plz.',  // ← fixed Pliz → Plz
      data: {
        profile: {
          firstName: profile.firstName,
          middleName: profile.middleName,
          lastName: profile.lastName,
          displayName: profile.displayName,
          dateOfBirth: profile.dateOfBirth,
          gender: profile.gender,
          phoneNumber: profile.phoneNumber,
          state: profile.state,
          city: profile.city,
          address: profile.address,   // ← added
          isAnonymous: profile.isAnonymous,
        },
      },
    });
  } catch (error: any) {
    logger.error('Complete profile error', {
      error: error.message,
      stack: error.stack,
    });
    sendResponse(res, 500, { success: false, message: 'Failed to complete profile' });
  }
};
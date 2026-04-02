import { Request, Response } from 'express';
import { OAuthService } from '../../services/oauth.service';
import { IApiResponse } from '../../types/user.interface';
import logger from '../../../../config/logger';

const sendResponse = <T = any>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

const buildUserResponse = (user: any) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role,
  isEmailVerified: user.isEmailVerified,
  isProfileComplete: user.isProfileComplete,   // ← frontend checks this
  isSuspended: user.isSuspended,
  isUnderInvestigation: user.isUnderInvestigation,
  authProvider: user.authProvider,
  avatar: user.avatar || null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  profile: user.profile || null,
});

/**
 * @route   POST /api/auth/google
 * @desc    Login or register with Google
 * @access  Public
 */
export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      sendResponse(res, 400, { success: false, message: 'Google ID token is required' });
      return;
    }

    // Verify token with Google
    const profile = await OAuthService.verifyGoogleToken(idToken);

    // Find or create user
    const { user, isNewUser } = await OAuthService.findOrCreateUser(profile);

    // Check if suspended
    if (user.isSuspended) {
      sendResponse(res, 403, {
        success: false,
        message: 'Your account has been suspended. Contact support@plz.app',
      });
      return;
    }

    // Create session and tokens
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ipAddress = (req.ip || 'Unknown').replace('::ffff:', '');

    const { accessToken, refreshToken } = await OAuthService.createOAuthSession(
      user,
      userAgent,
      ipAddress
    );

    logger.info('Google login successful', {
      userId: user.id,
      isNewUser,
      isProfileComplete: user.isProfileComplete,
    });

    // Determine next step for frontend
    const nextStep = !user.isProfileComplete ? 'complete_profile' : 'home';

    sendResponse(res, 200, {
      success: true,
      message: isNewUser
        ? 'Account created! Please complete your profile to continue.'
        : 'Login successful',
      data: {
        user: buildUserResponse(user),
        accessToken,
        refreshToken,
        isNewUser,
        nextStep,  // ← frontend uses this to decide where to redirect
      },
    });
  } catch (error: any) {
    logger.error('Google login error', { error: error.message });
    sendResponse(res, 401, {
      success: false,
      message: error.message || 'Google login failed. Please try again.',
    });
  }
};

/**
 * @route   POST /api/auth/apple
 * @desc    Login or register with Apple
 * @access  Public
 */
export const appleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { idToken, firstName, lastName } = req.body;

    if (!idToken) {
      sendResponse(res, 400, { success: false, message: 'Apple ID token is required' });
      return;
    }

    // Verify token with Apple
    const profile = await OAuthService.verifyAppleToken(idToken);

    // Apple only sends name on FIRST login — attach if provided
    if (firstName) profile.firstName = firstName;
    if (lastName) profile.lastName = lastName;
    if (firstName || lastName) {
      profile.displayName = [firstName, lastName].filter(Boolean).join(' ');
    }

    // Find or create user
    const { user, isNewUser } = await OAuthService.findOrCreateUser(profile);

    // Check if suspended
    if (user.isSuspended) {
      sendResponse(res, 403, {
        success: false,
        message: 'Your account has been suspended. Contact support@plz.app',
      });
      return;
    }

    // Create session and tokens
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ipAddress = (req.ip || 'Unknown').replace('::ffff:', '');

    const { accessToken, refreshToken } = await OAuthService.createOAuthSession(
      user,
      userAgent,
      ipAddress
    );

    logger.info('Apple login successful', {
      userId: user.id,
      isNewUser,
      isProfileComplete: user.isProfileComplete,
    });

    const nextStep = !user.isProfileComplete ? 'complete_profile' : 'home';

    sendResponse(res, 200, {
      success: true,
      message: isNewUser
        ? 'Account created! Please complete your profile to continue.'
        : 'Login successful',
      data: {
        user: buildUserResponse(user),
        accessToken,
        refreshToken,
        isNewUser,
        nextStep,
      },
    });
  } catch (error: any) {
    logger.error('Apple login error', { error: error.message });
    sendResponse(res, 401, {
      success: false,
      message: error.message || 'Apple login failed. Please try again.',
    });
  }
};
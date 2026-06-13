import { Request, Response } from 'express';
import { UserService } from '../../services/user.service';
import { createSessionAndTokens } from '../../services/create_session.service';
import { setRefreshTokenCookie } from '../../utils/refresh_cookie';
import {
  ILoginRequest,
  IUserResponse,
  IApiResponse,
} from '../../types/user.interface';
import logger from '../../../../config/logger';
import { toUserResponse } from '../../../admin/utils/admin-user-response';
import { CacheService } from '../../services/cacheService';



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
 * @route   POST /api/auth/login
 * @desc    Login user and create session
 * @access  Public
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as ILoginRequest;
    const ip = req.ip || 'unknown';
    logger.info('Login attempt', { email, ip });

    if (await CacheService.isLoginLocked(email, ip)) {
      logger.warn('Login blocked: too many failed attempts', { email, ip });
      sendResponse(res, 429, {
        success: false,
        message: 'Too many failed login attempts. Please try again later.',
      });
      return;
    }

    // ============================================
    // FIND USER
    // ============================================
    const user = await UserService.findByEmail(email);

    if (!user) {
      logger.warn('Login failed: User not found', { email });
      await CacheService.recordLoginFailure(email, ip);
      const response: IApiResponse = {
        success: false,
        message: 'Invalid email or password',
      };
      sendResponse(res, 401, response);
      return;
    }

    // ============================================
    // VERIFY PASSWORD
    // ============================================
    const isPasswordValid = await UserService.comparePassword(
      password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      logger.warn('Login failed: Invalid password', {
        userId: user.id,
        email,
      });
      await CacheService.recordLoginFailure(email, ip);
      const response: IApiResponse = {
        success: false,
        message: 'Invalid email or password',
      };
      sendResponse(res, 401, response);
      return;
    }

    await CacheService.clearLoginFailures(email, ip);

    if (UserService.passwordNeedsRehash(user.passwordHash)) {
      await UserService.updatePassword(user.id, password);
      logger.info('Password hash upgraded after successful login', { userId: user.id });
    }

    // ============================================
    // CHECK EMAIL VERIFICATION
    // ============================================
    if (!user.isEmailVerified && user.role === 'user') {
      logger.warn('Login failed: Email not verified', {
        userId: user.id,
        email,
      });
      const response: IApiResponse = {
        success: false,
        message: 'Please verify your email before logging in',
      };
      sendResponse(res, 403, response);
      return;
    }

    // ============================================
    // CHECK IF ACCOUNT IS SUSPENDED
    // ============================================
    if (user.isSuspended) {
      logger.warn('Login failed: Account suspended', {
        userId: user.id,
        email,
      });
      const response: IApiResponse = {
        success: false,
        message: 'Your account has been suspended. Please contact support.',
      };
      sendResponse(res, 403, response);
      return;
    }

    // ============================================
    // CHECK IF ACCOUNT IS DELETED
    // Same response as invalid credentials (avoid account enumeration).
    // ============================================
    if (user.isDeleted) {
      logger.warn('Login failed: Account deleted', {
        userId: user.id,
        email,
      });
      await CacheService.recordLoginFailure(email, ip);
      sendResponse(res, 401, {
        success: false,
        message: 'Invalid email or password',
      });
      return;
    }

    if (
      (user.role === 'admin' || user.role === 'superadmin') &&
      user.isTeamDisabled
    ) {
      logger.warn('Login failed: Team access disabled', { userId: user.id, email });
      sendResponse(res, 403, {
        success: false,
        message: 'Your admin access has been disabled. Contact your super admin.',
      });
      return;
    }

    const { accessToken, refreshToken: finalRefreshToken } =
      await createSessionAndTokens(req, user);

    logger.info('Login successful', {
      userId: user.id,
      email,
      role: user.role,
    });

    // ============================================
    // PREPARE RESPONSE
    // ============================================
    const userResponse: IUserResponse = toUserResponse(user);

    const response: IApiResponse<{
      user: IUserResponse;
      accessToken: string;
      refreshToken: string;
    }> = {
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        accessToken,
        refreshToken: finalRefreshToken,  // ✅ Use final refresh token
      },
    };

    setRefreshTokenCookie(res, finalRefreshToken);
    sendResponse(res, 200, response);
  } catch (error: any) {
    logger.error('Login error', {
      error: error.message,
      stack: error.stack,
    });

    const response: IApiResponse = {
      success: false,
      message: 'Login failed. Please try again.',
    };

    sendResponse(res, 500, response);
  }
};

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
    logger.info('Login attempt', { email, ip: req.ip });

    // ============================================
    // FIND USER
    // ============================================
    const user = await UserService.findByEmail(email);

    if (!user) {
      logger.warn('Login failed: User not found', { email });
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
      const response: IApiResponse = {
        success: false,
        message: 'Invalid email or password',
      };
      sendResponse(res, 401, response);
      return;
    }

    // ============================================
    // CHECK EMAIL VERIFICATION
    // ============================================
    if (!user.isEmailVerified) {
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
    const userResponse: IUserResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      isProfileComplete: user.isProfileComplete,
      isSuspended: user.isSuspended,
      isUnderInvestigation: user.isUnderInvestigation,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

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
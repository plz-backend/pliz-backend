import { Request, Response } from 'express';
import { UserService } from '../../services/user.service';
import { CacheService } from '../../services/cacheService';
import { createSessionAndTokens } from '../../services/create_session.service';
import { setRefreshTokenCookie } from '../../utils/refresh_cookie';
import { IApiResponse, IUserResponse } from '../../types/user.interface';
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

function getFrontendBase(): string {
  return (
    process.env.FRONTEND_URL ||
    process.env.EXPO_PUBLIC_FRONTEND_URL ||
    ''
  ).replace(/\/$/, '');
}

/**
 * Browser tab navigation to the API URL (old emails) → send user to the web app.
 * SPA / fetch uses Sec-Fetch-Mode: cors and gets JSON.
 */
function shouldRedirectBrowserToSpa(req: Request): boolean {
  if (req.query.api === '1' || req.query.format === 'json') {
    return false;
  }
  const sec =
    req.get('sec-fetch-mode') || req.get('Sec-Fetch-Mode') || '';
  return sec === 'navigate';
}

function toUserResponse(user: {
  id: string;
  username: string;
  email: string;
  role: IUserResponse['role'];
  isEmailVerified: boolean;
  emailVerifiedAt: Date | null;
  isProfileComplete: boolean;
  isSuspended: boolean;
  isUnderInvestigation: boolean;
  createdAt: Date;
  updatedAt: Date;
}): IUserResponse {
  return {
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
}

/**
 * @route   GET /api/auth/verify-email
 * @desc    Verify user email with token; returns session (same shape as login).
 * @access  Public
 */
export const verifyEmail = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      const response: IApiResponse = {
        success: false,
        message: 'Verification token is required',
      };
      sendResponse(res, 400, response);
      return;
    }

    const frontendBase = getFrontendBase();
    if (frontendBase && shouldRedirectBrowserToSpa(req)) {
      res.redirect(
        302,
        `${frontendBase}/verify-email?token=${encodeURIComponent(token)}`
      );
      return;
    }

    logger.info('Email verification attempt', { token: token.substring(0, 10) });

    const email = await CacheService.verifyEmailToken(token);

    if (!email) {
      logger.warn('Invalid or expired verification token', {
        token: token.substring(0, 10),
      });
      const response: IApiResponse = {
        success: false,
        message: 'Invalid or expired verification token',
      };
      sendResponse(res, 400, response);
      return;
    }

    const user = await UserService.findByEmail(email);

    if (!user) {
      logger.warn('User not found during verification', { email });
      const response: IApiResponse = {
        success: false,
        message: 'User not found',
      };
      sendResponse(res, 404, response);
      return;
    }

    if (user.isSuspended) {
      logger.warn('Email verification blocked: account suspended', {
        userId: user.id,
        email,
      });
      const response: IApiResponse = {
        success: false,
        message:
          'Your account has been suspended. Please contact support.',
      };
      sendResponse(res, 403, response);
      return;
    }

    let currentUser = user;

    if (user.isEmailVerified) {
      logger.info('Email already verified', { email, userId: user.id });
      await CacheService.deleteEmailToken(email);
    } else {
      const updated = await UserService.verifyEmail(email);
      if (!updated) {
        const response: IApiResponse = {
          success: false,
          message: 'Email verification failed. Please try again.',
        };
        sendResponse(res, 500, response);
        return;
      }
      await CacheService.deleteEmailToken(email);
      currentUser = updated;
      logger.info('Email verified successfully', { email, userId: user.id });
    }

    const { accessToken, refreshToken } = await createSessionAndTokens(
      req,
      currentUser
    );

    const userResponse = toUserResponse(currentUser);

    const response: IApiResponse<{
      user: IUserResponse;
      accessToken: string;
      refreshToken: string;
    }> = {
      success: true,
      message: user.isEmailVerified
        ? 'Email already verified. You are signed in.'
        : 'Email verified successfully!',
      data: {
        user: userResponse,
        accessToken,
        refreshToken,
      },
    };

    setRefreshTokenCookie(res, refreshToken);
    sendResponse(res, 200, response);
  } catch (error: any) {
    logger.error('Email verification error', {
      error: error.message,
      stack: error.stack,
    });

    const response: IApiResponse = {
      success: false,
      message: 'Email verification failed. Please try again.',
    };
    sendResponse(res, 500, response);
  }
};

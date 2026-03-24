import { TokenService } from '../../services/tokenService';
import { CacheService } from '../../services/cacheService';
import { Request, Response } from 'express';
import { UserService } from '../../services/user.service';
import { SessionService } from '../../services/session.service';
import { IUserResponse, IApiResponse } from '../../types/user.interface';
import { REFRESH_TOKEN_COOKIE_NAME } from '../../utils/refresh_cookie';
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
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
export const refreshToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const bodyToken =
      typeof req.body?.refreshToken === 'string'
        ? req.body.refreshToken.trim()
        : '';
    const cookieToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    const token =
      bodyToken ||
      (typeof cookieToken === 'string' ? cookieToken : '');

    if (!token) {
      const response: IApiResponse = {
        success: false,
        message: 'Refresh token is required',
      };
      sendResponse(res, 400, response);
      return;
    }

    logger.info('Refresh token request', { ip: req.ip });

    const decoded = TokenService.verifyRefreshToken(token);
    if (!decoded) {
      logger.warn('Invalid or expired refresh token');
      const response: IApiResponse = {
        success: false,
        message: 'Invalid or expired refresh token',
      };
      sendResponse(res, 401, response);
      return;
    }

    const userId = decoded.userId;
    const email = decoded?.email;

    if (!userId || !email) {
      logger.warn('Invalid token payload', { decoded });
      const response: IApiResponse = {
        success: false,
        message: 'Invalid token payload',
      };
      sendResponse(res, 401, response);
      return;
    }

    // Find the session with this refresh token (returns ISession)
    const session = await SessionService.findSessionByRefreshToken(token);

    if (!session) {
      logger.warn('Session not found for refresh token', { userId });
      const response: IApiResponse = {
        success: false,
        message: 'Invalid session',
      };
      sendResponse(res, 401, response);
      return;
    }

    // Check if session is active
    if (!session.active) {
      logger.warn('Session is inactive', { sessionId: session.id, userId });
      const response: IApiResponse = {
        success: false,
        message: 'Session has been terminated',
      };
      sendResponse(res, 401, response);
      return;
    }

    // Check if session has expired
    if (new Date() > new Date(session.expiresAt)) {
      logger.warn('Session has expired', { sessionId: session.id, userId });

      // Deactivate expired session
      await SessionService.deactivateSession(session.id);

      const response: IApiResponse = {
        success: false,
        message: 'Session has expired. Please login again',
      };
      sendResponse(res, 401, response);
      return;
    }

    // Get user data
    const user = await UserService.findById(userId);

    if (!user) {
      logger.warn('User not found during token refresh', { userId });
      const response: IApiResponse = {
        success: false,
        message: 'User not found',
      };
      sendResponse(res, 404, response);
      return;
    }

    // Generate new access token (with same session ID)
    const newAccessToken = TokenService.generateAccessToken(
      userId,
      email,
      user.role,
      session.id
    );

    // Update session last active time
    await SessionService.updateLastActive(session.id);

    // Update cached user session
    const userData = {
      email: user.email,
      username: user.username,
      role: user.role,
      lastLogin: new Date(),
    };
    await CacheService.cacheUserSession(userId, userData, 15 * 60);

    logger.info('Access token refreshed successfully', {
      userId,
      sessionId: session.id,
    });

    // Prepare response
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
      accessToken: string;
      user: IUserResponse;
    }> = {
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken,
        user: userResponse,
      },
    };
    sendResponse(res, 200, response);
  } catch (error: any) {
    logger.error('Refresh token error', {
      error: error.message,
      stack: error.stack,
    });

    const response: IApiResponse = {
      success: false,
      message: 'Failed to refresh token',
    };
    sendResponse(res, 500, response);
  }
};
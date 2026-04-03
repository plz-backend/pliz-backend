import { Request, Response } from 'express';
import { CacheService } from '../../services/cacheService';
import logger from '../../../../config/logger';
import { IApiResponse } from '../../types/user.interface';
import { SessionService } from '../../services/session.service';
import { clearRefreshTokenCookie } from '../../utils/refresh_cookie';




// ========== SESSION: Logout deactivates session and blacklists token ==========

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
 * @route   POST /api/auth/logout
 * @desc    Logout user (deactivate session and blacklist token)
 * @access  Private
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const sessionId = req.user?.sessionId;

    if (!userId) {
      const response: IApiResponse = {
        success: false,
        message: 'Unauthorized',
      };
      sendResponse(res, 401, response);
      return;
    }

    logger.info('Logout attempt', { userId, sessionId });

    // ========== SESSION: Deactivate the current session in database ==========
    if (sessionId) {
      await SessionService.deactivateSession(sessionId);
    }

    // ========== CACHE: Delete user session from cache ==========
    await CacheService.deleteUserSession(userId);

    // ========== CACHE: Blacklist the current access token ==========
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      // Blacklist for 15 minutes (access token expiry time)
      await CacheService.blacklistToken(token, 15 * 60);
    }

    logger.info('User logged out successfully', { userId, sessionId });

    clearRefreshTokenCookie(res);

    const response: IApiResponse = {
      success: true,
      message: 'Logged out successfully',
    };
    sendResponse(res, 200, response);
  } catch (error: any) {
    logger.error('Logout error', {
      error: error.message,
      stack: error.stack,
    });

    const response: IApiResponse = {
      success: false,
      message: 'Logout failed. Please try again.',
    };
    sendResponse(res, 500, response);
  }
};
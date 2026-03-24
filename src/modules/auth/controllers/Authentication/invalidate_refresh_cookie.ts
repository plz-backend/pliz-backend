import { Request, Response } from 'express';
import { CacheService } from '../../services/cacheService';
import { SessionService } from '../../services/session.service';
import { TokenService } from '../../services/tokenService';
import {
  clearRefreshTokenCookie,
  REFRESH_TOKEN_COOKIE_NAME,
} from '../../utils/refresh_cookie';
import { IApiResponse } from '../../types/user.interface';
import logger from '../../../../config/logger';

/**
 * @route   POST /api/auth/invalidate-refresh-cookie
 * @desc    Revoke session tied to httpOnly refresh cookie and clear cookie (web sign-out without Bearer).
 * @access  Public
 */
export const invalidateRefreshCookie = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const token = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    clearRefreshTokenCookie(res);

    if (!token || typeof token !== 'string') {
      const response: IApiResponse = {
        success: true,
        message: 'OK',
      };
      res.status(200).json(response);
      return;
    }

    const decoded = TokenService.verifyRefreshToken(token);
    if (!decoded) {
      const response: IApiResponse = {
        success: true,
        message: 'OK',
      };
      res.status(200).json(response);
      return;
    }

    const session = await SessionService.findSessionByRefreshToken(token);
    if (session?.active) {
      await SessionService.deactivateSession(session.id);
      await CacheService.deleteRefreshToken(session.id);
    }

    logger.info('Session invalidated via refresh cookie', {
      userId: decoded.userId,
    });

    const response: IApiResponse = {
      success: true,
      message: 'OK',
    };
    res.status(200).json(response);
  } catch (error: any) {
    logger.error('invalidateRefreshCookie error', {
      error: error.message,
    });
    clearRefreshTokenCookie(res);
    const response: IApiResponse = {
      success: false,
      message: 'Request failed',
    };
    res.status(500).json(response);
  }
};

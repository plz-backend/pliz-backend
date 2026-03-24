
import prisma from '../../../../config/database';
import { Request, Response } from 'express';
import { CacheService } from '../../services/cacheService';
import logger from '../../../../config/logger';
import { IApiResponse } from '../../types/user.interface';
import { clearRefreshTokenCookie } from '../../utils/refresh_cookie';


/**
 * @route   POST /api/auth/logout-all
 * @desc    Logout from all sessions
 * @access  Private
 */
export const logoutAll = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      const response: IApiResponse = {
        success: false,
        message: 'User not authenticated',
      };
      res.status(401).json(response);
      return;
    }

    logger.info('Logout all sessions attempt', { userId });

    // Get all active sessions
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        active: true,
      },
    });

    logger.info('Found active sessions', {
      userId,
      sessionCount: sessions.length,
    });

    // Deactivate all sessions
    // ✅ FIXED: Removed updatedAt - Prisma handles it automatically
    await prisma.session.updateMany({
      where: {
        userId,
        active: true,
      },
      data: {
        active: false,
        // ✅ REMOVED: updatedAt (Prisma's @updatedAt handles this)
      },
    });

    // Delete all refresh tokens from cache
    const cacheDeletePromises = sessions.map(session =>
      CacheService.deleteRefreshToken(session.id)
    );

    await Promise.all(cacheDeletePromises);

    logger.info('All sessions logged out successfully', {
      userId,
      sessionsDeactivated: sessions.length,
    });

    clearRefreshTokenCookie(res);

    const response: IApiResponse = {
      success: true,
      message: `Successfully logged out from all ${sessions.length} session(s)`,
      data: {
        sessionsDeactivated: sessions.length,
      },
    };

    res.status(200).json(response);
  } catch (error: any) {
    logger.error('Logout all error', {
      error: error.message,
      stack: error.stack,
      userId: req.user?.userId,
    });

    const response: IApiResponse = {
      success: false,
      message: 'Failed to logout from all sessions',
    };

    res.status(500).json(response);
  }
};
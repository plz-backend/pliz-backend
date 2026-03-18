import { Request, Response, NextFunction } from 'express';
import { CooldownService } from '../../../services/cooldown.service';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

/**
 * Middleware to check if user is on cooldown before creating a beg
 */
export const checkCooldown = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      const response: IApiResponse = {
        success: false,
        message: 'User not authenticated',
      };
      res.status(401).json(response);
      return;
    }

    // Check cooldown
    const cooldownInfo = await CooldownService.checkCooldown(userId);

    if (cooldownInfo.isOnCooldown) {
      logger.warn('User on cooldown tried to create beg', {
        userId,
        nextAllowed: cooldownInfo.nextRequestAllowedAt,
      });

      const response: IApiResponse = {
        success: false,
        message: cooldownInfo.message || 'You are currently on cooldown',
        data: {
          isOnCooldown: true,
          nextRequestAllowedAt: cooldownInfo.nextRequestAllowedAt,
          hoursRemaining: cooldownInfo.hoursRemaining,
        },
      };
      res.status(429).json(response);
      return;
    }

    next();
  } catch (error: any) {
    logger.error('Error checking cooldown', {
      error: error.message,
      stack: error.stack,
    });

    const response: IApiResponse = {
      success: false,
      message: 'Failed to check cooldown',
    };
    res.status(500).json(response);
  }
};
import { Request, Response, NextFunction } from 'express';
import prisma from '../../../../config/database';
import { IApiResponse } from '../../types/user.interface';
import logger from '../../../../config/logger';

/**
 * Middleware to check if user has completed their profile
 */
export const checkProfileComplete = async (
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

    // Check if user has completed profile
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isProfileComplete: true },
    });

    if (!user?.isProfileComplete) {
      logger.warn('User tried to create beg without completing profile', { userId });

      const response: IApiResponse = {
        success: false,
        message: 'Please complete your profile before creating a beg',
      };
      res.status(403).json(response);
      return;
    }

    next();
  } catch (error: any) {
    logger.error('Error checking profile completion', {
      error: error.message,
      stack: error.stack,
    });

    const response: IApiResponse = {
      success: false,
      message: 'Failed to verify profile completion',
    };
    res.status(500).json(response);
  }
};
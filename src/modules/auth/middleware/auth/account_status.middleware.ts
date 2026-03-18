import { Request, Response, NextFunction } from 'express';
import { UserService } from '../../services/user.service';
import { IApiResponse } from '../../types/user.interface';
import logger from '../../../../config/logger';

/**
 * Middleware to check if user account is suspended
 */
export const checkNotSuspended = async (
  req: Request,
  res: Response,
  next: NextFunction
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

    const user = await UserService.findById(userId);

    if (!user) {
      logger.warn('User not found in suspension check', { userId });
      const response: IApiResponse = {
        success: false,
        message: 'User not found',
      };
      res.status(404).json(response);
      return;
    }

    if (user.isSuspended) {
      logger.warn('Suspended user attempted restricted action', {
        userId,
        email: user.email,
        path: req.path,
      });
      const response: IApiResponse = {
        success: false,
        message: 'Your account has been suspended. You cannot perform this action.',
        errors: [
          {
            field: 'account',
            message: 'Account suspended. Please contact support for assistance.',
          },
        ],
      };
      res.status(403).json(response);
      return;
    }

    next();
  } catch (error: any) {
    logger.error('Account status check error', {
      error: error.message,
      userId: req.user?.userId,
    });
    const response: IApiResponse = {
      success: false,
      message: 'Failed to verify account status',
    };
    res.status(500).json(response);
  }
};

/**
 * Middleware to check if user account is under investigation
 */
export const checkNotUnderInvestigation = async (
  req: Request,
  res: Response,
  next: NextFunction
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

    const user = await UserService.findById(userId);

    if (!user) {
      logger.warn('User not found in investigation check', { userId });
      const response: IApiResponse = {
        success: false,
        message: 'User not found',
      };
      res.status(404).json(response);
      return;
    }

    if (user.isUnderInvestigation) {
      logger.warn('User under investigation attempted restricted action', {
        userId,
        email: user.email,
        path: req.path,
      });
      const response: IApiResponse = {
        success: false,
        message: 'Your account is under investigation. You cannot perform this action at this time.',
        errors: [
          {
            field: 'account',
            message: 'Account under investigation. Please contact support.',
          },
        ],
      };
      res.status(403).json(response);
      return;
    }

    next();
  } catch (error: any) {
    logger.error('Investigation status check error', {
      error: error.message,
      userId: req.user?.userId,
    });
    const response: IApiResponse = {
      success: false,
      message: 'Failed to verify account status',
    };
    res.status(500).json(response);
  }
};

/**
 * Combined middleware - checks both suspension and investigation
 */
export const checkAccountStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
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

    const user = await UserService.findById(userId);

    if (!user) {
      logger.warn('User not found in account status check', { userId });
      const response: IApiResponse = {
        success: false,
        message: 'User not found',
      };
      res.status(404).json(response);
      return;
    }

    if (user.isSuspended) {
      logger.warn('Suspended user attempted restricted action', {
        userId,
        email: user.email,
        path: req.path,
      });
      const response: IApiResponse = {
        success: false,
        message: 'Your account has been suspended. You cannot perform this action.',
        errors: [
          {
            field: 'account',
            message: 'Account suspended. Please contact support for assistance.',
          },
        ],
      };
      res.status(403).json(response);
      return;
    }

    if (user.isUnderInvestigation) {
      logger.warn('User under investigation attempted restricted action', {
        userId,
        email: user.email,
        path: req.path,
      });
      const response: IApiResponse = {
        success: false,
        message: 'Your account is under investigation. You cannot perform this action at this time.',
        errors: [
          {
            field: 'account',
            message: 'Account under investigation. Please contact support.',
          },
        ],
      };
      res.status(403).json(response);
      return;
    }

    next();
  } catch (error: any) {
    logger.error('Account status check error', {
      error: error.message,
      userId: req.user?.userId,
    });
    const response: IApiResponse = {
      success: false,
      message: 'Failed to verify account status',
    };
    res.status(500).json(response);
  }
};
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
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const user = await UserService.findById(userId);

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // ── BLOCK DELETED ACCOUNTS ─────────────
    if (user.isDeleted) {
      logger.warn('Deleted user attempted action', { userId, path: req.path });
      res.status(403).json({
        success: false,
        message: 'This account has been deleted. Contact support@plz.ng if this is a mistake.',
        code: 'ACCOUNT_DELETED',
      });
      return;
    }

    if (user.isSuspended) {
      logger.warn('Suspended user attempted restricted action', {
        userId,
        email: user.email,
        path: req.path,
      });
      res.status(403).json({
        success: false,
        message: 'Your account has been suspended. You cannot perform this action.',
        errors: [
          {
            field: 'account',
            message: 'Account suspended. Please contact support for assistance.',
          },
        ],
      });
      return;
    }

    next();
  } catch (error: any) {
    logger.error('Account status check error', {
      error: error.message,
      userId: req.user?.userId,
    });
    res.status(500).json({ success: false, message: 'Failed to verify account status' });
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
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const user = await UserService.findById(userId);

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // ── BLOCK DELETED ACCOUNTS ─────────────
    if (user.isDeleted) {
      logger.warn('Deleted user attempted action', { userId, path: req.path });
      res.status(403).json({
        success: false,
        message: 'This account has been deleted. Contact support@plz.ng if this is a mistake.',
        code: 'ACCOUNT_DELETED',
      });
      return;
    }

    if (user.isUnderInvestigation) {
      logger.warn('User under investigation attempted restricted action', {
        userId,
        email: user.email,
        path: req.path,
      });
      res.status(403).json({
        success: false,
        message: 'Your account is under investigation. You cannot perform this action at this time.',
        errors: [
          {
            field: 'account',
            message: 'Account under investigation. Please contact support.',
          },
        ],
      });
      return;
    }

    next();
  } catch (error: any) {
    logger.error('Investigation status check error', {
      error: error.message,
      userId: req.user?.userId,
    });
    res.status(500).json({ success: false, message: 'Failed to verify account status' });
  }
};

/**
 * Combined middleware — checks deletion, suspension and investigation
 */
export const checkAccountStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' });
      return;
    }

    const user = await UserService.findById(userId);

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // ── BLOCK DELETED ACCOUNTS ─────────────
    if (user.isDeleted) {
      logger.warn('Deleted user attempted action', { userId, path: req.path });
      res.status(403).json({
        success: false,
        message: 'This account has been deleted. Contact support@plz.ng if this is a mistake.',
        code: 'ACCOUNT_DELETED',
      });
      return;
    }

    // ── BLOCK SUSPENDED ACCOUNTS ───────────
    if (user.isSuspended) {
      logger.warn('Suspended user attempted restricted action', {
        userId,
        email: user.email,
        path: req.path,
      });
      res.status(403).json({
        success: false,
        message: 'Your account has been suspended. You cannot perform this action.',
        errors: [
          {
            field: 'account',
            message: 'Account suspended. Please contact support for assistance.',
          },
        ],
      });
      return;
    }

    // ── BLOCK ACCOUNTS UNDER INVESTIGATION ─
    if (user.isUnderInvestigation) {
      logger.warn('User under investigation attempted restricted action', {
        userId,
        email: user.email,
        path: req.path,
      });
      res.status(403).json({
        success: false,
        message: 'Your account is under investigation. You cannot perform this action at this time.',
        errors: [
          {
            field: 'account',
            message: 'Account under investigation. Please contact support.',
          },
        ],
      });
      return;
    }

    next();
  } catch (error: any) {
    logger.error('Account status check error', {
      error: error.message,
      userId: req.user?.userId,
    });
    res.status(500).json({ success: false, message: 'Failed to verify account status' });
  }
};
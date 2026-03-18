import { Request, Response, NextFunction } from 'express';
import { IApiResponse, UserRole } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

/**
 * Require user to be Admin or SuperAdmin
 */
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const userRole = req.user?.role;
  const userId = req.user?.userId;

  if (!userRole || (userRole !== UserRole.admin && userRole !== UserRole.superadmin)) {
    logger.warn('Admin access denied', {
      userId,
      role: userRole,
      path: req.path,
      method: req.method,
    });

    const response: IApiResponse = {
      success: false,
      message: 'Admin access required',
    };

    res.status(403).json(response);
    return;
  }

  logger.debug('Admin access granted', {
    userId,
    role: userRole,
    path: req.path,
  });

  next();
};

/**
 * Require user to be SuperAdmin only
 */
export const requireSuperAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const userRole = req.user?.role;
  const userId = req.user?.userId;

  if (!userRole || userRole !== UserRole.superadmin) {
    logger.warn('SuperAdmin access denied', {
      userId,
      role: userRole,
      path: req.path,
      method: req.method,
    });

    const response: IApiResponse = {
      success: false,
      message: 'SuperAdmin access required',
    };

    res.status(403).json(response);
    return;
  }

  logger.debug('SuperAdmin access granted', {
    userId,
    path: req.path,
  });

  next();
};
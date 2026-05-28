import { Request, Response, NextFunction, RequestHandler } from 'express';
import prisma from '../../../config/database';
import { IApiResponse } from '../../auth/types/user.interface';
import {
  AdminPermissionKey,
  userHasPermission,
} from '../permissions';
import logger from '../../../config/logger';

/**
 * Require a specific admin permission (call after authenticate + requireAdmin).
 */
export function requirePermission(permission: AdminPermissionKey): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'User not authenticated' } satisfies IApiResponse);
      return;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, adminStaffRole: true, isTeamDisabled: true },
      });

      if (!user || user.isTeamDisabled) {
        res.status(403).json({ success: false, message: 'Team access disabled' } satisfies IApiResponse);
        return;
      }

      if (!userHasPermission(user, permission)) {
        logger.warn('Permission denied', { userId, permission, path: req.path });
        res.status(403).json({
          success: false,
          message: 'You do not have permission to perform this action',
        } satisfies IApiResponse);
        return;
      }

      next();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Permission check failed';
      logger.error('Permission check error', { userId, permission, error: message });
      res.status(500).json({ success: false, message: 'Permission check failed' } satisfies IApiResponse);
    }
  };
}

/**
 * Blocks admin API access until forced password change is completed.
 */
export async function requirePasswordChanged(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    next();
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { mustChangePassword: true, role: true },
    });

    if (
      user &&
      user.mustChangePassword &&
      (user.role === 'admin' || user.role === 'superadmin') &&
      !req.path.includes('/change-password')
    ) {
      res.status(403).json({
        success: false,
        message: 'Password change required before accessing the admin console',
        data: { mustChangePassword: true },
      } satisfies IApiResponse);
      return;
    }

    next();
  } catch {
    next();
  }
}

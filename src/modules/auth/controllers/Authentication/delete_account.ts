import { Request, Response } from 'express';
import prisma from '../../../../config/database';
import { IApiResponse } from '../../types/user.interface';
import logger from '../../../../config/logger';

const sendResponse = <T = any>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   DELETE /api/auth/account
 * @desc    Soft delete user account
 *          Account is deactivated — data is kept
 *          User can no longer login or use the app
 * @access  Private
 * @body    { reason?: string }
 */
export const deleteAccount = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { reason } = req.body;

    // ── CHECK USER EXISTS ──────────────────
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isDeleted: true,
      },
    });

    if (!user) {
      sendResponse(res, 404, {
        success: false,
        message: 'User not found',
      });
      return;
    }

    if (user.isDeleted) {
      sendResponse(res, 400, {
        success: false,
        message: 'Account is already deleted',
      });
      return;
    }

    // ── SOFT DELETE ────────────────────────
    // Mark account as deleted
    // Invalidate all sessions
    await prisma.$transaction([
      // Mark user as deleted
      prisma.user.update({
        where: { id: userId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy: userId,          // deleted by self
          deleteReason: reason || 'User requested account deletion',
          isProfileComplete: false,   // block profile access
        },
      }),

      // Invalidate all active sessions
      prisma.session.updateMany({
        where: { userId, active: true },
        data: { active: false },
      }),
    ]);

    logger.info('Account soft deleted', {
      userId,
      email: user.email,
      reason: reason || 'No reason provided',
    });

    sendResponse(res, 200, {
      success: true,
      message: 'Your account has been deleted. We are sorry to see you go.',
    });
  } catch (error: any) {
    logger.error('Delete account error', {
      error: error.message,
      stack: error.stack,
    });
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to delete account. Please try again.',
    });
  }
};
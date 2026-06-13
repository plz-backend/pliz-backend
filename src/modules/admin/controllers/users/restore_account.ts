import { Request, Response } from 'express';
import prisma from '../../../../config/database';
import logger from '../../../../config/logger';

/**
 * @route   PATCH /api/admin/users/:userId/restore
 * @desc    Restore a soft-deleted account
 * @access  Admin
 */
export const restoreAccount = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;
    const adminId = (req as any).user?.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isDeleted: true,
        email: true,
        profile: { select: { agreeToTerms: true } },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (!user.isDeleted) {
      res.status(400).json({ success: false, message: 'Account is not deleted' });
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedBy: null,
        deleteReason: null,
        isProfileComplete: Boolean(user.profile?.agreeToTerms),
      },
    });

    logger.info('Account restored by admin', { userId, adminId });

    res.status(200).json({
      success: true,
      message: 'Account restored successfully',
    });
  } catch (error: any) {
    logger.error('Restore account error', { error: error.message });
    res.status(500).json({ success: false, message: 'Failed to restore account' });
  }
};

import { Request, Response } from 'express';
import prisma from '../../../../config/database';
import { AdminService } from '../../services/admin.service';
import { IApiResponse } from '../../../auth/types/user.interface';
import { NotificationService } from '../../../notifications/services/notification.service';
import logger from '../../../../config/logger';

const sendResponse = <T = any>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

// ============================================
// HELPER
// ============================================
const buildBegTitle = (
  category: { name: string; icon: string | null } | null,
  description: string | null
): string => {
  if (!category) return 'Help Request';
  const icon = category.icon ? ` ${category.icon}` : '';
  const desc = description ? ` — ${description}` : '';
  return `${category.name}${icon}${desc}`;
};

interface BegParams {
  id: string;
}

/**
 * @route   PATCH /api/admin/begs/:id/approve
 * @desc    Approve a beg request
 * @access  Admin
 */
export const approveBeg = async (
  req: Request<BegParams>,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = (req as any).user?.userId;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';

    // Get beg details
    const beg = await prisma.beg.findUnique({
      where: { id },
      select: {
        id: true,
        description: true,                // ← title removed
        approved: true,
        status: true,
        userId: true,
        expiryHours: true,
        category: {                        // ← added
          select: { name: true, icon: true },
        },
        user: {
          select: {
            email: true,
            username: true,
          },
        },
      },
    });

    if (!beg) {
      sendResponse(res, 404, { success: false, message: 'Beg not found' });
      return;
    }

    if (beg.approved) {
      sendResponse(res, 400, { success: false, message: 'Beg is already approved' });
      return;
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + beg.expiryHours);

    // Approve beg — countdown starts from approval, not submission
    const updatedBeg = await prisma.beg.update({
      where: { id },
      data: {
        approved: true,
        approvedAt: new Date(),
        approvedBy: adminId,
        expiresAt,
      },
    });

    const begTitle = buildBegTitle(beg.category, beg.description);  // ← uses helper

    // Log admin action
    await AdminService.logAction({
      adminId,
      actionType: 'approve_beg',
      targetType: 'beg',
      targetId: id,
      description: `Approved beg: ${begTitle}`,                     // ← uses helper
      metadata: {
        begTitle,                                                     // ← uses helper
        userId: beg.userId,
        userEmail: beg.user.email,
      },
      ipAddress: ip,
    });

    logger.info('Beg approved', {
      begId: id,
      begTitle,                                                       // ← uses helper
      adminId,
    });

    const notified = await NotificationService.begApproved({
      userId: beg.userId,
      begId: id,
      begTitle,
    });
    if (!notified) {
      logger.error('Beg approved but inbox notification was not persisted', {
        begId: id,
        userId: beg.userId,
      });
    }

    sendResponse(res, 200, {
      success: true,
      message: 'Beg approved successfully',
      data: {
        id: updatedBeg.id,
        approved: updatedBeg.approved,
        approved_at: updatedBeg.approvedAt,
      },
    });
  } catch (error: any) {
    logger.error('Approve beg error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: error.message || 'Failed to approve beg',
    });
  }
};
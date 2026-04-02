import { Request, Response } from 'express';
import prisma from '../../../../config/database';
import { AdminService } from '../../services/admin.service';
import { IApiResponse } from '../../../auth/types/user.interface';
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
 * @route   PATCH /api/admin/begs/:id/reject
 * @desc    Reject a beg request
 * @access  Admin
 */
export const rejectBeg = async (
  req: Request<BegParams>,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = (req as any).user?.userId;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';

    if (!reason) {
      sendResponse(res, 400, { success: false, message: 'Rejection reason is required' });
      return;
    }

    // Get beg details
    const beg = await prisma.beg.findUnique({
      where: { id },
      select: {
        id: true,
        description: true,               // ← title removed
        approved: true,
        status: true,
        userId: true,
        category: {                       // ← added
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

    // Update beg status to rejected
    const updatedBeg = await prisma.beg.update({
      where: { id },
      data: {
        status: 'rejected',
        approved: false,
        rejectionReason: reason,
        rejectedAt: new Date(),
        rejectedBy: adminId,
      },
    });

    const begTitle = buildBegTitle(beg.category, beg.description);  // ← uses helper

    // Log admin action
    await AdminService.logAction({
      adminId,
      actionType: 'reject_beg',
      targetType: 'beg',
      targetId: id,
      description: `Rejected beg: ${begTitle}. Reason: ${reason}`,  // ← uses helper
      metadata: {
        begTitle,                                                      // ← uses helper
        userId: beg.userId,
        userEmail: beg.user.email,
        reason,
      },
      ipAddress: ip,
    });

    logger.warn('Beg rejected', {
      begId: id,
      begTitle,                                                        // ← uses helper
      reason,
      adminId,
    });

    sendResponse(res, 200, {
      success: true,
      message: 'Beg rejected successfully',
      data: {
        id: updatedBeg.id,
        status: updatedBeg.status,
        rejection_reason: updatedBeg.rejectionReason,
        rejected_at: updatedBeg.rejectedAt,
      },
    });
  } catch (error: any) {
    logger.error('Reject beg error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: error.message || 'Failed to reject beg',
    });
  }
};
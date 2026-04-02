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
 * @route   DELETE /api/admin/begs/:id
 * @desc    Delete a beg (admin only, for policy violations)
 * @access  Admin
 */
export const deleteBeg = async (
  req: Request<BegParams>,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = (req as any).user?.userId;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';

    if (!reason) {
      sendResponse(res, 400, { success: false, message: 'Deletion reason is required' });
      return;
    }

    // Get beg details
    const beg = await prisma.beg.findUnique({
      where: { id },
      select: {
        id: true,
        description: true,               // ← title removed
        amountRaised: true,
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

    // Check if beg has received donations
    const amountRaised = parseFloat(beg.amountRaised.toString());
    if (amountRaised > 0) {
      sendResponse(res, 400, {
        success: false,
        message: 'Cannot delete beg that has received donations. Consider rejecting instead.',
      });
      return;
    }

    // Delete beg
    await prisma.beg.delete({ where: { id } });

    const begTitle = buildBegTitle(beg.category, beg.description);  // ← uses helper

    // Log admin action
    await AdminService.logAction({
      adminId,
      actionType: 'delete_beg',
      targetType: 'beg',
      targetId: id,
      description: `Deleted beg: ${begTitle}. Reason: ${reason}`,   // ← uses helper
      metadata: {
        begTitle,                                                      // ← uses helper
        userId: beg.userId,
        userEmail: beg.user.email,
        reason,
      },
      ipAddress: ip,
    });

    logger.warn('Beg deleted by admin', {
      begId: id,
      begTitle,                                                        // ← uses helper
      reason,
      adminId,
    });

    sendResponse(res, 200, { success: true, message: 'Beg deleted successfully' });
  } catch (error: any) {
    logger.error('Delete beg error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: error.message || 'Failed to delete beg',
    });
  }
};
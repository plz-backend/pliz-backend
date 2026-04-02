import { Request, Response } from 'express';
import prisma from '../../../../config/database';
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

/**
 * @route   GET /api/admin/begs
 * @desc    Get all begs with filters (for admin review)
 * @access  Admin
 */
export const getAllBegs = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const approved = req.query.approved === 'true' ? true :
                     req.query.approved === 'false' ? false : undefined;
    const categoryId = req.query.categoryId as string;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;
    if (approved !== undefined) where.approved = approved;
    if (categoryId) where.categoryId = categoryId;

    const [begs, total] = await Promise.all([
      prisma.beg.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              isSuspended: true,
              isUnderInvestigation: true,
              stats: {
                select: {
                  abuseFlags: true,
                  requestsCount: true,
                },
              },
            },
          },
          category: {
            select: {
              name: true,
              icon: true,
            },
          },
        },
      }),
      prisma.beg.count({ where }),
    ]);

    sendResponse(res, 200, {
      success: true,
      message: 'Begs retrieved successfully',
      data: {
        begs: (begs as any[]).map((b) => ({
          id: b.id,
          title: buildBegTitle(b.category, b.description),  // ← uses helper
          description: b.description,
          amount_requested: parseFloat(b.amountRequested.toString()),
          amount_raised: parseFloat(b.amountRaised.toString()),
          status: b.status,
          approved: b.approved,
          approved_at: b.approvedAt,
          rejected_at: b.rejectedAt,
          rejection_reason: b.rejectionReason,
          category: b.category,
          user: {
            id: b.user.id,
            email: b.user.email,
            username: b.user.username,
            is_suspended: b.user.isSuspended,
            is_under_investigation: b.user.isUnderInvestigation,
            abuse_flags: b.user.stats?.abuseFlags || 0,
            requests_count: b.user.stats?.requestsCount || 0,
          },
          created_at: b.createdAt,
          expires_at: b.expiresAt,
        })),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error('Get all begs error', { error: error.message });
    sendResponse(res, 500, { success: false, message: 'Failed to retrieve begs' });
  }
};
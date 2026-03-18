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

/**
 * @route   GET /api/admin/activity
 * @desc    Get admin activity log
 * @access  Admin
 */
export const getAdminActions = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const actionType = req.query.actionType as string;
    const adminId = req.query.adminId as string;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (actionType) where.actionType = actionType;
    if (adminId) where.adminId = adminId;

    const [actions, total] = await Promise.all([
      prisma.adminAction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
          targetUser: {
            select: {
              id: true,
              email: true,
              username: true,
            },
          },
        },
      }),
      prisma.adminAction.count({ where }),
    ]);

    sendResponse(res, 200, {
      success: true,
      message: 'Admin actions retrieved successfully',
      data: {
        actions: actions.map((a) => ({
          id: a.id,
          admin: {
            id: a.admin.id,
            email: a.admin.email,
            username: a.admin.username,
          },
          action_type: a.actionType,
          target_type: a.targetType,
          target_id: a.targetId,
          target_user: a.targetUser,
          description: a.description,
          metadata: a.metadata,
          ip_address: a.ipAddress,
          created_at: a.createdAt,
        })),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error('Get admin actions error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve admin actions',
    });
  }
};
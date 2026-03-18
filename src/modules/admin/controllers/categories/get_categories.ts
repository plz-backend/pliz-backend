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
 * @route   GET /api/admin/categories
 * @desc    Get all categories (including inactive)
 * @access  Admin
 */
export const getCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const includeInactive = req.query.includeInactive === 'true';

    const where: any = {};
    if (!includeInactive) {
      where.isActive = true;
    }

    const categories = await prisma.category.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            begs: true,
          },
        },
      },
    });

    sendResponse(res, 200, {
      success: true,
      message: 'Categories retrieved successfully',
      data: {
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          icon: c.icon,
          description: c.description,
          is_active: c.isActive,
          begs_count: c._count.begs,
          created_at: c.createdAt,
        })),
      },
    });
  } catch (error: any) {
    logger.error('Get categories error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve categories',
    });
  }
};
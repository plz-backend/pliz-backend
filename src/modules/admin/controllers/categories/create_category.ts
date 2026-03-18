import { Request, Response } from 'express';
import prisma from '../../../../config/database';
import { CategoryService } from '../../../Beg/services/category.service';
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

/**
 * Generate URL-friendly slug from name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/-+/g, '-');      // Replace multiple hyphens with single hyphen
}

/**
 * @route   POST /api/admin/categories
 * @desc    Create a new category
 * @access  Admin
 */
export const createCategory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, icon, description } = req.body;
    const adminId = (req as any).user?.userId;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';

    if (!name) {
      sendResponse(res, 400, {
        success: false,
        message: 'Category name is required',
      });
      return;
    }

    // Generate slug from name
    const slug = generateSlug(name);

    // Check if category already exists (by name or slug)
    const existing = await prisma.category.findFirst({
      where: {
        OR: [
          {
            name: {
              equals: name,
              mode: 'insensitive',
            },
          },
          { slug },
        ],
      },
    });

    if (existing) {
      sendResponse(res, 400, {
        success: false,
        message: 'Category with this name already exists',
      });
      return;
    }

    // Create category
    const category = await prisma.category.create({
      data: {
        name: name.toLowerCase(),
        slug,
        icon: icon || '📁',
        description: description || null,
        isActive: true,
      },
    });

    // Invalidate cache and reload
    await CategoryService.invalidateCache();
    await CategoryService.loadCategoriesToCache();

    // Log admin action
    await AdminService.logAction({
      adminId,
      actionType: 'create_category',
      targetType: 'category',
      targetId: category.id,
      description: `Created category: ${category.name}`,
      metadata: { name: category.name, slug: category.slug, icon: category.icon },
      ipAddress: ip,
    });

    logger.info('Category created', {
      categoryId: category.id,
      name: category.name,
      slug: category.slug,
      adminId,
    });

    sendResponse(res, 201, {
      success: true,
      message: 'Category created successfully',
      data: { category },
    });
  } catch (error: any) {
    logger.error('Create category error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: error.message || 'Failed to create category',
    });
  }
};
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

interface CategoryParams {
  id: string;
}

/**
 * Generate URL-friendly slug from name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * @route   PATCH /api/admin/categories/:id
 * @desc    Update a category
 * @access  Admin
 */
export const updateCategory = async (
  req: Request<CategoryParams>,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, icon, description, isActive } = req.body;
    const adminId = (req as any).user?.userId;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';

    // Check if category exists
    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      sendResponse(res, 404, {
        success: false,
        message: 'Category not found',
      });
      return;
    }

    // Build update data
    const updateData: any = {};
    
    if (name) {
      updateData.name = name.toLowerCase();
      updateData.slug = generateSlug(name);
      
      // Check if new slug conflicts with existing category
      const existing = await prisma.category.findFirst({
        where: {
          slug: updateData.slug,
          id: { not: id },
        },
      });

      if (existing) {
        sendResponse(res, 400, {
          success: false,
          message: 'A category with this name already exists',
        });
        return;
      }
    }
    
    if (icon) updateData.icon = icon;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Update category
    const updatedCategory = await prisma.category.update({
      where: { id },
      data: updateData,
    });

    // Invalidate cache and reload
    await CategoryService.invalidateCache();
    await CategoryService.loadCategoriesToCache();

    // Log admin action
    await AdminService.logAction({
      adminId,
      actionType: 'update_category',
      targetType: 'category',
      targetId: id,
      description: `Updated category: ${updatedCategory.name}`,
      metadata: {
        changes: req.body,
        oldName: category.name,
        newName: updatedCategory.name,
      },
      ipAddress: ip,
    });

    logger.info('Category updated', {
      categoryId: id,
      name: updatedCategory.name,
      adminId,
    });

    sendResponse(res, 200, {
      success: true,
      message: 'Category updated successfully',
      data: { category: updatedCategory },
    });
  } catch (error: any) {
    logger.error('Update category error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: error.message || 'Failed to update category',
    });
  }
};
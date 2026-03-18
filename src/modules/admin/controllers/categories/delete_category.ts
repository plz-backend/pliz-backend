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
 * @route   DELETE /api/admin/categories/:id
 * @desc    Delete a category (soft delete - set inactive)
 * @access  Admin
 */
export const deleteCategory = async (
  req: Request<CategoryParams>,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
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

    // Check if category is being used
    const begsUsingCategory = await prisma.beg.count({
      where: { categoryId: id },
    });

    if (begsUsingCategory > 0) {
      sendResponse(res, 400, {
        success: false,
        message: `Cannot delete category. ${begsUsingCategory} beg(s) are using this category. Consider deactivating instead.`,
      });
      return;
    }

    // Soft delete - set inactive
    const updatedCategory = await prisma.category.update({
      where: { id },
      data: { isActive: false },
    });

    // Invalidate cache and reload
    await CategoryService.invalidateCache();
    await CategoryService.loadCategoriesToCache();

    // Log admin action
    await AdminService.logAction({
      adminId,
      actionType: 'delete_category',
      targetType: 'category',
      targetId: id,
      description: `Deleted/deactivated category: ${category.name}`,
      metadata: { name: category.name },
      ipAddress: ip,
    });

    logger.info('Category deleted/deactivated', {
      categoryId: id,
      name: category.name,
      adminId,
    });

    sendResponse(res, 200, {
      success: true,
      message: 'Category deactivated successfully',
      data: { category: updatedCategory },
    });
  } catch (error: any) {
    logger.error('Delete category error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: error.message || 'Failed to delete category',
    });
  }
};
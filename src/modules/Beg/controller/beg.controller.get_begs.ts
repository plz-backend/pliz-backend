import { Request, Response } from 'express';
import { BegService } from '../services/beg.service';
import { CategoryService } from '../services/category.service';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

/**
 * Helper to send response
 */
const sendResponse = <T = any>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   GET /api/begs
 * @desc    Get active begs (feed)
 * @access  Public
 * @query   category (name) OR categoryId (UUID)
 */
export const getBegs = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const categoryName = req.query.category as string;
    const categoryIdParam = req.query.categoryId as string;

    logger.info('Get begs request', { page, limit, categoryName, categoryIdParam });

    let categoryId: string | undefined;

    // Priority: categoryId > category name
    if (categoryIdParam) {
      // Direct UUID provided - use it (fastest)
      categoryId = categoryIdParam;
    } else if (categoryName) {
      // Category name provided - convert to UUID
      const foundId = await CategoryService.getCategoryIdByName(categoryName);
      
      if (!foundId) {
        sendResponse(res, 400, {
          success: false,
          message: `Invalid category: ${categoryName}`,
        });
        return;
      }
      
      categoryId = foundId;
    }

    // Get begs
    const result = await BegService.getActiveBegs(page, limit, categoryId);

    sendResponse(res, 200, {
      success: true,
      message: 'Begs retrieved successfully',
      data: {
        begs: result.begs,
        pagination: {
          page,
          limit,
          total: result.total,
          pages: result.pages,
        },
      },
    });
  } catch (error: any) {
    logger.error('Get begs error', {
      error: error.message,
      stack: error.stack,
    });

    sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve begs',
    });
  }
};
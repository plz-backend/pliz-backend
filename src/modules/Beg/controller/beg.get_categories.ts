import { Request, Response } from 'express';
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
 * @route   GET /api/begs/categories
 * @desc    Get all active categories
 * @access  Public
 */
export const getCategories = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    logger.info('Get categories request');

    const categories = await CategoryService.getActiveCategories();

    const response: IApiResponse = {
      success: true,
      message: 'Categories retrieved successfully',
      data: { categories },
    };

    sendResponse(res, 200, response);
  } catch (error: any) {
    logger.error('Get categories error', {
      error: error.message,
      stack: error.stack,
    });

    const response: IApiResponse = {
      success: false,
      message: 'Failed to retrieve categories',
    };

    sendResponse(res, 500, response);
  }
};
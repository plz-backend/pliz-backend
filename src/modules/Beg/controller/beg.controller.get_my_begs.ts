import { Request, Response } from 'express';
import { BegService } from '../services/beg.service';
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
 * @route   GET /api/begs/my-begs
 * @desc    Get current user's begs
 * @access  Private
 */
export const getMyBegs = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    logger.info('Get my begs request', { userId, page, limit });

    const result = await BegService.getUserBegs(userId, page, limit);

    const response: IApiResponse = {
      success: true,
      message: 'Your begs retrieved successfully',
      data: {
        begs: result.begs,
        pagination: {
          page,
          limit,
          total: result.total,
          pages: result.pages,
        },
      },
    };

    sendResponse(res, 200, response);
  } catch (error: any) {
    logger.error('Get my begs error', {
      error: error.message,
      stack: error.stack,
    });

    const response: IApiResponse = {
      success: false,
      message: 'Failed to retrieve your begs',
    };

    sendResponse(res, 500, response);
  }
};
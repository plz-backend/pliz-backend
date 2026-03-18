import { Request, Response } from 'express';
import { TrustScoreService } from '../../../../src/services/trust_score.service';
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
 * @route   GET /api/begs/trust/progress
 * @desc    Get user's trust tier progress
 * @access  Private
 */
export const getTrustProgress = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      const response: IApiResponse = {
        success: false,
        message: 'User not authenticated',
      };
      sendResponse(res, 401, response);
      return;
    }

    logger.info('Get trust progress request', { userId });

    const progress = await TrustScoreService.getTrustProgress(userId);

    logger.info('Trust progress retrieved', { userId, score: progress.currentScore });

    const response: IApiResponse = {
      success: true,
      message: 'Trust progress retrieved successfully',
      data: { progress },
    };

    sendResponse(res, 200, response);
  } catch (error: any) {
    logger.error('Get trust progress error', {
      error: error.message,
      stack: error.stack,
    });

    const response: IApiResponse = {
      success: false,
      message: 'Failed to retrieve trust progress',
    };

    sendResponse(res, 500, response);
  }
};
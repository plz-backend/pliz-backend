import { Request, Response } from 'express';
import { TrustScoreService } from '../../../services/trust_score.service';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

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
      sendResponse(res, 401, {
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    const progress = await TrustScoreService.getTrustProgress(userId);

    logger.info('Trust progress retrieved', {
      userId,
      tier: progress.currentTier,
    });

    sendResponse(res, 200, {
      success: true,
      message: 'Trust progress retrieved successfully',
      data: { progress },
    });
  } catch (error: any) {
    logger.error('Get trust progress error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve trust progress',
    });
  }
};

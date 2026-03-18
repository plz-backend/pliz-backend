import { Request, Response } from 'express';
import { DonorRankService } from '../services/donor_rank.service';
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
 * @route   GET /api/donations/my-rank
 * @desc    Get donor's current rank from DB (cached in Redis)
 * @access  Private
 */
export const getDonorRank = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    const rank = await DonorRankService.getDonorRank(userId);

    if (!rank) {
      sendResponse(res, 200, {
        success: true,
        message: 'No donations yet',
        data: {
          rank_name: null,
          total_donated: 0,
          donation_count: 0,
          streak_days: 0,
          message: 'Make your first donation to earn a rank!',
        },
      });
      return;
    }

    sendResponse(res, 200, {
      success: true,
      message: 'Donor rank retrieved successfully',
      data: { rank },
    });
  } catch (error: any) {
    logger.error('Get donor rank error', { error: error.message });
    sendResponse(res, 500, { success: false, message: 'Failed to retrieve donor rank' });
  }
};
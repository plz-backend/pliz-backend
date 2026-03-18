import { Request, Response } from 'express';
import { WithdrawalService } from '../services/withdrawal.service';
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
 * @route   GET /api/withdrawals
 * @desc    Get user's withdrawal history
 * @access  Private
 */
export const getWithdrawals = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await WithdrawalService.getUserWithdrawals(userId, page, limit);

    sendResponse(res, 200, {
      success: true,
      message: 'Withdrawals retrieved successfully',
      data: result,
    });
  } catch (error: any) {
    logger.error('Get withdrawals error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve withdrawals',
    });
  }
};
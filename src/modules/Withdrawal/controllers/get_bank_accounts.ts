import { Request, Response } from 'express';
import { BankService } from '../services/bank.service';
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
 * @route   GET /api/withdrawals/bank-accounts
 * @desc    Get user's bank accounts
 * @access  Private
 */
export const getBankAccounts = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    const accounts = await BankService.getUserBankAccounts(userId);

    sendResponse(res, 200, {
      success: true,
      message: 'Bank accounts retrieved successfully',
      data: { accounts },
    });
  } catch (error: any) {
    logger.error('Get bank accounts error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve bank accounts',
    });
  }
};
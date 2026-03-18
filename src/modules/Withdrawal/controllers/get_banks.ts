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
 * @route   GET /api/withdrawals/banks
 * @desc    Get list of Nigerian banks
 * @access  Private
 */
export const getBanks = async (req: Request, res: Response): Promise<void> => {
  try {
    const banks = await BankService.getNigerianBanks();

    sendResponse(res, 200, {
      success: true,
      message: 'Banks retrieved successfully',
      data: { banks },
    });
  } catch (error: any) {
    logger.error('Get banks error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve banks',
    });
  }
};
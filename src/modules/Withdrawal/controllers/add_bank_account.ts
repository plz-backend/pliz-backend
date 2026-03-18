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
 * @route   POST /api/withdrawals/bank-accounts
 * @desc    Add and verify bank account
 * @access  Private
 */
export const addBankAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { accountNumber, bankCode } = req.body;

    if (!accountNumber || !bankCode) {
      sendResponse(res, 400, {
        success: false,
        message: 'Account number and bank code are required',
      });
      return;
    }

    // Validate account number (10 digits)
    if (!/^\d{10}$/.test(accountNumber)) {
      sendResponse(res, 400, {
        success: false,
        message: 'Account number must be 10 digits',
      });
      return;
    }

    const bankAccount = await BankService.addBankAccount(userId, accountNumber, bankCode);

    sendResponse(res, 201, {
      success: true,
      message: 'Bank account added successfully',
      data: { bankAccount },
    });
  } catch (error: any) {
    logger.error('Add bank account error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: error.message || 'Failed to add bank account',
    });
  }
};
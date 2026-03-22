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
 * @route   POST /api/withdrawals/resolve-account
 * @desc    Resolve account holder name (Paystack) without saving
 * @access  Private
 */
export const resolveBankAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { accountNumber, bankCode } = req.body;

    if (!accountNumber || !bankCode) {
      sendResponse(res, 400, {
        success: false,
        message: 'Account number and bank code are required',
      });
      return;
    }

    const acct = String(accountNumber).trim();
    const code = String(bankCode).trim();

    if (!/^\d{10}$/.test(acct)) {
      sendResponse(res, 400, {
        success: false,
        message: 'Account number must be 10 digits',
      });
      return;
    }

    const verified = await BankService.verifyBankAccount(acct, code);

    sendResponse(res, 200, {
      success: true,
      message: 'Account resolved successfully',
      data: {
        accountName: verified.accountName,
        accountNumber: verified.accountNumber,
        bankCode: verified.bankCode,
      },
    });
  } catch (error: any) {
    logger.error('Resolve bank account error', { error: error.message });
    const message = error.message || 'Could not verify bank account';
    sendResponse(res, 400, {
      success: false,
      message,
    });
  }
};

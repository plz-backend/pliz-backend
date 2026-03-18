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
 * @route   DELETE /api/withdrawals/bank-accounts/:id
 * @desc    Delete a bank account
 * @access  Private
 */
export const deleteBankAccount = async (
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

    // Handle string | string[] type
    const accountId = typeof req.params.id === 'string'
      ? req.params.id
      : req.params.id?.[0];

    if (!accountId) {
      sendResponse(res, 400, {
        success: false,
        message: 'Bank account ID is required',
      });
      return;
    }

    // Use your existing service method
    await BankService.deleteBankAccount(userId, accountId);

    logger.info('Bank account deleted', {
      userId,
      accountId,
    });

    sendResponse(res, 200, {
      success: true,
      message: 'Bank account deleted successfully',
    });
  } catch (error: any) {
    logger.error('Delete bank account error', {
      error: error.message,
      userId: (req as any).user?.userId,
      accountId: req.params.id,
    });

    const statusCode = error.message.includes('not found') ? 404 :
                       error.message.includes('pending withdrawals') ? 400 : 500;

    sendResponse(res, statusCode, {
      success: false,
      message: error.message || 'Failed to delete bank account',
    });
  }
};
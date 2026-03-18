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
 * @route   POST /api/withdrawals/request
 * @desc    Request withdrawal
 * @access  Private
 */
export const requestWithdrawal = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { begId, bankAccountId } = req.body;

    if (!begId) {
      sendResponse(res, 400, {
        success: false,
        message: 'Beg ID is required',
      });
      return;
    }

    const withdrawal = await WithdrawalService.requestWithdrawal(
      userId,
      begId,
      bankAccountId
    );

    const amountToReceive = parseFloat(withdrawal.amountToReceive.toString());

    // Check if withdrawal was auto-processed
    if (withdrawal.status === 'completed') {
      // Updated message to mention email
      sendResponse(res, 201, {
        success: true,
        message: 'Withdrawal processed successfully! Check your email for details. Funds will arrive in 5-30 minutes.',
        data: {
          withdrawal: {
            id: withdrawal.id,
            amount_to_receive: amountToReceive,
            bank_account: {
              account_number: withdrawal.bankAccount.accountNumber,
              account_name: withdrawal.bankAccount.accountName,
              bank_name: withdrawal.bankAccount.bankName,
            },
            status: withdrawal.status,
            transfer_reference: withdrawal.transferReference,
            auto_processed: withdrawal.autoProcessed,
            created_at: withdrawal.createdAt,
            processed_at: withdrawal.processedAt,
          },
        },
      });
    } else {
      // Updated message to mention email
      sendResponse(res, 201, {
        success: true,
        message: 'Withdrawal request received. We will process it within 24 hours. You will receive an email confirmation.',
        data: {
          withdrawal: {
            id: withdrawal.id,
            amount_to_receive: amountToReceive,
            bank_account: {
              account_number: withdrawal.bankAccount.accountNumber,
              account_name: withdrawal.bankAccount.accountName,
              bank_name: withdrawal.bankAccount.bankName,
            },
            status: withdrawal.status,
            created_at: withdrawal.createdAt,
          },
        },
      });
    }
  } catch (error: any) {
    logger.error('Request withdrawal error', {
      error: error.message,
      userId: (req as any).user?.userId,
    });

    sendResponse(res, 400, {
      success: false,
      message: error.message || 'Failed to request withdrawal',
    });
  }
};
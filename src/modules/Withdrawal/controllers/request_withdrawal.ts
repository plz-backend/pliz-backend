import { Request, Response } from 'express';
import { WithdrawalService } from '../services/withdrawal.service';
import { toUserWithdrawalRequestMessage } from '../utils/withdrawal-errors';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';
import { maskAccountNumber } from '../../../utils/crypto.util';
import prisma from '../../../config/database';

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
    const { begId, bankAccountId, transactionPin } = req.body;

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
      bankAccountId,
      transactionPin
    );

    const amountToReceive = parseFloat(withdrawal.amountToReceive.toString());

    const submittedMessage =
      'Withdrawal submitted successfully! Funds typically arrive in your bank account within 24 hours. Check your email for details.';

    if (withdrawal.status === 'completed' || withdrawal.status === 'processing') {
      sendResponse(res, 201, {
        success: true,
        message: submittedMessage,
        data: {
          withdrawal: {
            id: withdrawal.id,
            amount_to_receive: amountToReceive,
            bank_account: {
              account_number: maskAccountNumber(withdrawal.bankAccount.accountNumber),
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
      sendResponse(res, 201, {
        success: true,
        message:
          'Withdrawal request received. We will process it within 24 hours. You will receive an email confirmation.',
        data: {
          withdrawal: {
            id: withdrawal.id,
            amount_to_receive: amountToReceive,
            bank_account: {
              account_number: maskAccountNumber(withdrawal.bankAccount.accountNumber),
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
    const userId = (req as any).user?.userId;
    const { begId } = req.body;

    let internalFailureReason: string | null = null;
    if (begId && userId) {
      const latest = await prisma.withdrawal.findFirst({
        where: { begId, userId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, failureReason: true, transferReference: true },
      });
      internalFailureReason = latest?.failureReason ?? null;
      logger.error('Request withdrawal error', {
        error: error.message,
        userId,
        begId,
        withdrawalId: latest?.id,
        withdrawalStatus: latest?.status,
        internalFailureReason,
        transferReference: latest?.transferReference,
        userMessage: toUserWithdrawalRequestMessage(error),
      });
    } else {
      logger.error('Request withdrawal error', {
        error: error.message,
        userId,
        begId,
        userMessage: toUserWithdrawalRequestMessage(error),
      });
    }

    sendResponse(res, 400, {
      success: false,
      message: toUserWithdrawalRequestMessage(error),
    });
  }
};

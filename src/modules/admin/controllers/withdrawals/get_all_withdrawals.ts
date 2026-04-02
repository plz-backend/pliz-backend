import { Request, Response } from 'express';
import prisma from '../../../../config/database';
import { Decimal } from '@prisma/client/runtime/library';
import { IApiResponse } from '../../../auth/types/user.interface';
import logger from '../../../../config/logger';

const sendResponse = <T = any>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

// ============================================
// TYPED INTERFACE FOR WITHDRAWAL WITH RELATIONS
// ============================================
interface IWithdrawalWithRelations {
  id: string;
  userId: string;
  begId: string;
  bankAccountId: string;
  amountRequested: Decimal;
  companyFee: Decimal;
  vatFee: Decimal;
  totalFees: Decimal;
  amountToReceive: Decimal;
  transferReference: string | null;
  status: string;
  failureReason: string | null;
  autoProcessed: boolean;
  processedAt: Date | null;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    username: string;
    isSuspended: boolean;
    isUnderInvestigation: boolean;
  };
  beg: {
    id: string;
    description: string | null;
  };
  bankAccount: {
    accountNumber: string;
    accountName: string;
    bankName: string;
  };
}

/**
 * @route   GET /api/admin/withdrawals
 * @desc    Get all withdrawals with filters
 * @access  Admin
 */
export const getAllWithdrawals = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [withdrawals, total] = await Promise.all([
      prisma.withdrawal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              isSuspended: true,
              isUnderInvestigation: true,
            },
          },
          beg: {
            select: {
              id: true,
              description: true,
            },
          },
          bankAccount: {
            select: {
              accountNumber: true,
              accountName: true,
              bankName: true,
            },
          },
        },
      }) as Promise<IWithdrawalWithRelations[]>,
      prisma.withdrawal.count({ where }),
    ]);

    sendResponse(res, 200, {
      success: true,
      message: 'Withdrawals retrieved successfully',
      data: {
        withdrawals: withdrawals.map((w: IWithdrawalWithRelations) => ({
          id: w.id,
          user: {
            id: w.user.id,
            email: w.user.email,
            username: w.user.username,
            is_suspended: w.user.isSuspended,
            is_under_investigation: w.user.isUnderInvestigation,
          },
          beg: {
            id: w.beg.id,
            description: w.beg.description,
          },
          amount_requested: parseFloat(w.amountRequested.toString()),
          company_fee: parseFloat(w.companyFee.toString()),
          vat_fee: parseFloat(w.vatFee.toString()),
          total_fees: parseFloat(w.totalFees.toString()),
          amount_to_receive: parseFloat(w.amountToReceive.toString()),
          bank_account: {
            account_number: w.bankAccount.accountNumber,
            account_name: w.bankAccount.accountName,
            bank_name: w.bankAccount.bankName,
          },
          status: w.status,
          auto_processed: w.autoProcessed,
          transfer_reference: w.transferReference,
          failure_reason: w.failureReason,
          created_at: w.createdAt,
          processed_at: w.processedAt,
        })),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error('Get all withdrawals error', { error: error.message });
    sendResponse(res, 500, { success: false, message: 'Failed to retrieve withdrawals' });
  }
};
import { Request, Response } from 'express';
import prisma from '../../../../config/database';
import { IApiResponse } from '../../../auth/types/user.interface';
import logger from '../../../../config/logger';

const sendResponse = <T = any>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

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
              title: true,
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
      }),
      prisma.withdrawal.count({ where }),
    ]);

    sendResponse(res, 200, {
      success: true,
      message: 'Withdrawals retrieved successfully',
      data: {
        withdrawals: withdrawals.map((w) => ({
          id: w.id,
          user: {
            id: w.user.id,
            email: w.user.email,
            username: w.user.username,
            is_suspended: w.user.isSuspended,
            is_under_investigation: w.user.isUnderInvestigation,
          },
          beg: w.beg,
          amount_requested: parseFloat(w.amountRequested.toString()),
          company_fee: parseFloat(w.companyFee.toString()),
          vat_fee: parseFloat(w.vatFee.toString()),
          total_fees: parseFloat(w.totalFees.toString()),
          amount_to_receive: parseFloat(w.amountToReceive.toString()),
          bank_account: w.bankAccount,
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
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve withdrawals',
    });
  }
};
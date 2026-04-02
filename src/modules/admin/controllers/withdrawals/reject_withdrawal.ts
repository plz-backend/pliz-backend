import { Request, Response } from 'express';
import prisma from '../../../../config/database';
import { Decimal } from '@prisma/client/runtime/library';
import { AdminService } from '../../services/admin.service';
import { WithdrawalEmailService } from '../../../Withdrawal/services/withdrawal_email.service';
import { IApiResponse } from '../../../auth/types/user.interface';
import logger from '../../../../config/logger';

const sendResponse = <T = any>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

interface WithdrawalParams {
  id: string;
}

interface IWithdrawalRejectRelations {
  id: string;
  userId: string;
  begId: string;
  bankAccountId: string;
  amountRequested: Decimal;
  amountToReceive: Decimal;
  companyFee: Decimal;
  vatFee: Decimal;
  totalFees: Decimal;
  transferReference: string | null;
  status: string;
  failureReason: string | null;
  autoProcessed: boolean;
  processedAt: Date | null;
  createdAt: Date;
  user: {
    email: string;
    username: string;
    profile: {
      displayName: string | null;
    } | null;
  };
  beg: {
    description: string | null;
    category: {
      name: string;
    };
  };
  bankAccount: {
    accountNumber: string;
    accountName: string;
    bankName: string;
  };
}

/**
 * @route   POST /api/admin/withdrawals/:id/reject
 * @desc    Reject a withdrawal
 * @access  Admin
 */
export const rejectWithdrawal = async (
  req: Request<WithdrawalParams>,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = (req as any).user?.userId;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';

    if (!reason) {
      sendResponse(res, 400, { success: false, message: 'Rejection reason is required' });
      return;
    }

    // Get withdrawal details
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            email: true,
            username: true,
            profile: {
              select: { displayName: true },
            },
          },
        },
        beg: {
          select: {
            description: true,
            category: {
              select: { name: true },
            },
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
    }) as IWithdrawalRejectRelations | null;

    if (!withdrawal) {
      sendResponse(res, 404, { success: false, message: 'Withdrawal not found' });
      return;
    }

    // Update withdrawal status
    const updated = await prisma.withdrawal.update({
      where: { id },
      data: {
        status: 'failed',
        failureReason: `Rejected by admin: ${reason}`,
      },
    });

    // Send rejection email
    const recipientName = withdrawal.user.profile?.displayName || withdrawal.user.username;
    const begTitle = `${withdrawal.beg.category.name}${withdrawal.beg.description ? ` — ${withdrawal.beg.description}` : ''}`;

    await WithdrawalEmailService.sendFailureEmail(withdrawal.user.email, {
      recipientName,
      amount: Number(withdrawal.amountToReceive),
      bankName: withdrawal.bankAccount.bankName,
      accountNumber: withdrawal.bankAccount.accountNumber,
      failureReason: `Your withdrawal was rejected by our team. Reason: ${reason}`,
      begTitle,
      supportEmail: process.env.SUPPORT_EMAIL || 'support@pliz.app',
    });

    // Log admin action
    await AdminService.logAction({
      adminId,
      actionType: 'reject_withdrawal',
      targetType: 'withdrawal',
      targetId: id,
      description: `Rejected withdrawal ${id}. Reason: ${reason}`,
      metadata: {
        withdrawalId: id,
        reason,
        userId: withdrawal.userId,
      },
      ipAddress: ip,
    });

    logger.warn('Withdrawal rejected by admin', { withdrawalId: id, reason, adminId });

    sendResponse(res, 200, {
      success: true,
      message: 'Withdrawal rejected successfully. User has been notified via email.',
      data: {
        withdrawal: {
          id: updated.id,
          status: updated.status,
          failure_reason: updated.failureReason,
        },
      },
    });
  } catch (error: any) {
    logger.error('Reject withdrawal error', {
      error: error.message,
      withdrawalId: req.params.id,
    });
    sendResponse(res, 500, {
      success: false,
      message: error.message || 'Failed to reject withdrawal',
    });
  }
};
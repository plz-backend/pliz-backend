import { Request, Response } from 'express';
import { WithdrawalService } from '../../../Withdrawal/services/withdrawal.service';
import { AdminService } from '../../services/admin.service';
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

/**
 * @route   POST /api/admin/withdrawals/:id/process
 * @desc    Manually process a withdrawal
 * @access  Admin
 */
export const processWithdrawal = async (
  req: Request<WithdrawalParams>,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = (req as any).user?.userId;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';

    // Process withdrawal
    const withdrawal = await WithdrawalService.processWithdrawal(id, false);

    // Log admin action
    await AdminService.logAction({
      adminId,
      actionType: 'process_withdrawal',
      targetType: 'withdrawal',
      targetId: id,
      description: `Manually processed withdrawal ${id}`,
      metadata: {
        withdrawalId: id,
        amount: Number(withdrawal.amountToReceive),
        transferReference: withdrawal.transferReference,
      },
      ipAddress: ip,
    });

    logger.info('Withdrawal processed manually by admin', {
      withdrawalId: id,
      adminId,
    });

    // ✅ Updated message to mention email
    sendResponse(res, 200, {
      success: true,
      message: 'Withdrawal processed successfully. User has been notified via email.',
      data: {
        withdrawal: {
          id: withdrawal.id,
          status: withdrawal.status,
          transfer_reference: withdrawal.transferReference,
          amount_to_receive: Number(withdrawal.amountToReceive),
          processed_at: withdrawal.processedAt,
        },
      },
    });
  } catch (error: any) {
    logger.error('Process withdrawal error', {
      error: error.message,
      withdrawalId: req.params.id,
    });

    sendResponse(res, 500, {
      success: false,
      message: error.message || 'Failed to process withdrawal',
    });
  }
};
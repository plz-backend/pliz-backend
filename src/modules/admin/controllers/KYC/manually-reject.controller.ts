import { Request, Response } from 'express';
import { KYCService } from '../../../KYC/services/kyc.service';
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
 * @route   PATCH /api/admin/kyc/:userId/reject
 * @desc    Manually reject a user's verification
 * @access  Admin
 */
export const manuallyReject = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const adminId = (req as any).user?.userId;
    const userId = req.params.userId as string;
    const { reason } = req.body;

    if (!reason) {
      sendResponse(res, 400, {
        success: false,
        message: 'Rejection reason is required',
      });
      return;
    }

    await KYCService.manuallyReject(userId, adminId, reason);

    sendResponse(res, 200, {
      success: true,
      message: 'Verification rejected successfully',
    });
  } catch (error: any) {
    logger.error('Admin manually reject error', { error: error.message });
    const statusCode =
      error.message.includes('not found') ? 404 :
      error.message.includes('already verified') ? 400 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};
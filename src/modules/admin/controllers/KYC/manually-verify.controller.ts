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
 * @route   PATCH /api/admin/kyc/:userId/verify
 * @desc    Manually verify a user's identity
 * @access  Admin
 */
export const manuallyVerify = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const adminId = (req as any).user?.userId;
    const userId = req.params.userId as string;
    const { note } = req.body;

    await KYCService.manuallyVerify(userId, adminId, note);

    sendResponse(res, 200, {
      success: true,
      message: 'User identity verified successfully',
    });
  } catch (error: any) {
    logger.error('Admin manually verify error', { error: error.message });
    const statusCode =
      error.message.includes('not found') ? 404 :
      error.message.includes('already verified') ? 400 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};
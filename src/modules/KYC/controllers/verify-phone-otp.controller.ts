import { Request, Response } from 'express';
import { KYCService } from '../services/kyc.service';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

const sendResponse = <T = any>(res: Response, statusCode: number, response: IApiResponse<T>): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   POST /api/kyc/phone/verify-otp
 * @desc    Verify phone OTP
 * @access  Private
 */
export const verifyPhoneOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { otp } = req.body;

    await KYCService.verifyPhoneOTP(userId, otp);

    sendResponse(res, 200, {
      success: true,
      message: 'Phone number verified! Now verify your identity to start creating begs.',
    });
  } catch (error: any) {
    logger.error('Verify phone OTP error', { error: error.message });
    const statusCode =
      error.message.includes('expired') ? 400 :
      error.message.includes('Invalid') ? 400 :
      error.message.includes('already') ? 400 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};
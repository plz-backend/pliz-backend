import { Request, Response } from 'express';
import { KYCService } from '../services/kyc.service';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

const sendResponse = <T = any>(res: Response, statusCode: number, response: IApiResponse<T>): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   POST /api/kyc/phone/send-otp
 * @desc    Send OTP to phone number from profile
 * @access  Private
 */
export const sendPhoneOTP = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    await KYCService.sendPhoneOTP(userId);

    sendResponse(res, 200, {
      success: true,
      message: 'OTP sent to your phone number. Valid for 10 minutes.',
    });
  } catch (error: any) {
    logger.error('Send phone OTP error', { error: error.message });
    const statusCode =
      error.message.includes('already verified') ? 400 :
      error.message.includes('not found') ? 404 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};
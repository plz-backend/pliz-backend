import { Request, Response } from 'express';
import { PhoneVerificationService } from '../services/phone-verification.service';
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
 * @route   POST /api/kyc/phone/send-otp
 * @access  Private
 */
export const sendOTP = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    const result = await PhoneVerificationService.sendPhoneOTP(userId);

    sendResponse(res, 200, {
      success: true,
      message: `OTP sent! SMS sent to ${result.phoneNumber}. Valid for 10 minutes.`,
      data: {
        phoneNumber: result.phoneNumber,
      },
    });
  } catch (error: any) {
    logger.error('Send OTP error', { error: error.message });
    const statusCode =
      error.message.includes('already verified') ? 400 :
      error.message.includes('not found') ? 404 : 500;
    sendResponse(res, statusCode, {
      success: false,
      message: error.message,
    });
  }
};

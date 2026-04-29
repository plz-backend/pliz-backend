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
 * @route   POST /api/kyc/phone/verify-otp
 * @access  Private
 * @body    { otp: "123456" }
 */
export const verifyOTP = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { otp } = req.body;

    await PhoneVerificationService.verifyPhoneOTP(userId, otp);

    sendResponse(res, 200, {
      success: true,
      message: 'Phone number verified successfully! You can now upload your identity document.',
    });
  } catch (error: any) {
    logger.error('Verify OTP error', { error: error.message });
    const statusCode =
      error.message.includes('already verified') ? 400 :
      error.message.includes('expired') ? 400 :
      error.message.includes('Invalid') ? 400 :
      error.message.includes('request an OTP') ? 400 : 500;
    sendResponse(res, statusCode, {
      success: false,
      message: error.message,
    });
  }
};
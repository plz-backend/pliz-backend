import { Request, Response } from 'express';
import { PhoneVerificationService, OTPChannel } from '../services/phone-verification.service';
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
 * @route   POST /api/kyc/phone/resend-otp
 * @access  Private
 * @body    { channel: "sms" | "whatsapp" }  ← optional, uses previous channel if omitted
 */
export const resendOTP = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const channel = req.body.channel as OTPChannel | undefined;

    const result = await PhoneVerificationService.resendPhoneOTP(
      userId,
      channel
    );

    const channelMessage =
      result.channel === 'whatsapp'
        ? `WhatsApp message sent to ${result.phoneNumber}`
        : `SMS sent to ${result.phoneNumber}`;

    sendResponse(res, 200, {
      success: true,
      message: `New OTP sent! ${channelMessage}. Valid for 10 minutes.`,
      data: {
        channel: result.channel,
        phoneNumber: result.phoneNumber,
      },
    });
  } catch (error: any) {
    logger.error('Resend OTP error', { error: error.message });
    const statusCode =
      error.message.includes('already verified') ? 400 :
      error.message.includes('wait') ? 429 :
      error.message.includes('not found') ? 404 :
      error.message.includes('not available') ? 503 : 500;
    sendResponse(res, statusCode, {
      success: false,
      message: error.message,
    });
  }
};
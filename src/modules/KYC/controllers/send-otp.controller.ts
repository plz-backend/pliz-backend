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
 * @route   POST /api/kyc/phone/send-otp
 * @access  Private
 * @body    { channel: "sms" | "whatsapp" }  ← optional, defaults to sms
 */
export const sendOTP = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const channel = (req.body.channel as OTPChannel) || 'sms';

    const result = await PhoneVerificationService.sendPhoneOTP(
      userId,
      channel
    );

    const channelMessage =
      result.channel === 'whatsapp'
        ? `WhatsApp message sent to ${result.phoneNumber}`
        : `SMS sent to ${result.phoneNumber}`;

    sendResponse(res, 200, {
      success: true,
      message: `OTP sent! ${channelMessage}. Valid for 10 minutes.`,
      data: {
        channel: result.channel,
        phoneNumber: result.phoneNumber,
      },
    });
  } catch (error: any) {
    logger.error('Send OTP error', { error: error.message });
    const statusCode =
      error.message.includes('already verified') ? 400 :
      error.message.includes('not found') ? 404 :
      error.message.includes('not available') ? 503 : 500;
    sendResponse(res, statusCode, {
      success: false,
      message: error.message,
    });
  }
};
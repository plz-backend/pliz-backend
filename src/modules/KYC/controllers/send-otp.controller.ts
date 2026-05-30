import { Request, Response } from 'express';
import { PhoneVerificationService } from '../services/phone-verification.service';
import { IApiResponse } from '../../auth/types/user.interface';
import { PhoneOtpChannel } from '../types/kyc.interface';
import logger from '../../../config/logger';

const sendResponse = <T = any>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

function parseOtpChannel(body: Record<string, unknown>): PhoneOtpChannel {
  return body.channel === 'whatsapp' ? 'whatsapp' : 'sms';
}

/**
 * @route   POST /api/kyc/phone/send-otp
 * @access  Private
 * @body    { channel?: "sms" | "whatsapp" }
 */
export const sendOTP = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const channel = parseOtpChannel(req.body ?? {});

    const result = await PhoneVerificationService.sendPhoneOTP(userId, channel);
    const delivery = PhoneVerificationService.deliveryLabelForChannel(result.channel);

    sendResponse(res, 200, {
      success: true,
      message: `OTP sent! ${delivery} sent to ${result.phoneNumber}. Valid for 10 minutes.`,
      data: {
        phoneNumber: result.phoneNumber,
        channel: result.channel,
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

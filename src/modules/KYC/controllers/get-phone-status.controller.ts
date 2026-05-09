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
 * @route   GET /api/kyc/phone/status
 * @access  Private
 */
export const getPhoneStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const status =
      await PhoneVerificationService.getPhoneVerificationStatus(userId);

    sendResponse(res, 200, {
      success: true,
      message: 'Phone verification status retrieved',
      data: status,
    });
  } catch (error: any) {
    logger.error('Get phone status error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to get phone verification status',
    });
  }
};
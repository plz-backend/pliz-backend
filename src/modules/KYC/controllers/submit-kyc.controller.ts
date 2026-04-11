import { Request, Response } from 'express';
import { KYCService } from '../services/kyc.service';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

const sendResponse = <T = any>(res: Response, statusCode: number, response: IApiResponse<T>): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   POST /api/kyc/submit
 * @desc    Submit KYC verification — first time
 * @access  Private
 */
export const submitKYC = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const result = await KYCService.submitKYC(userId, req.body);

    sendResponse(res, 200, {
      success: true,
      message: 'Verification submitted! You will be notified within a few minutes.',
      data: {
        verification: result,
        estimatedTime: 'Less than 2 minutes',
      },
    });
  } catch (error: any) {
    logger.error('Submit KYC error', { error: error.message });
    const statusCode =
      error.message.includes('already verified') ? 400 :
      error.message.includes('Maximum') ? 429 :
      error.message.includes('phone number') ? 403 :
      error.message.includes('profile') ? 400 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};
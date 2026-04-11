import { Request, Response } from 'express';
import { KYCService } from '../services/kyc.service';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

const sendResponse = <T = any>(res: Response, statusCode: number, response: IApiResponse<T>): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   PUT /api/kyc/update
 * @desc    Resubmit KYC after rejection with corrected details
 * @access  Private
 */
export const updateKYC = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const result = await KYCService.updateKYC(userId, req.body);

    sendResponse(res, 200, {
      success: true,
      message: 'Verification resubmitted! You will be notified within a few minutes.',
      data: {
        verification: result,
        estimatedTime: 'Less than 2 minutes',
      },
    });
  } catch (error: any) {
    logger.error('Update KYC error', { error: error.message });
    const statusCode =
      error.message.includes('not found') ? 404 :
      error.message.includes('already verified') ? 400 :
      error.message.includes('Maximum') ? 429 :
      error.message.includes('pending') ? 400 :
      error.message.includes('review') ? 400 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};
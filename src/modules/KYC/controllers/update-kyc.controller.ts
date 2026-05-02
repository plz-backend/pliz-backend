import { Request, Response } from 'express';
import { KYCService } from '../services/kyc.service';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

const sendResponse = <T = any>(res: Response, statusCode: number, response: IApiResponse<T>): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   PUT /api/kyc/update
 * @desc    Reset and resubmit after rejection
 * @access  Private
 */
export const updateKYC = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const result = await KYCService.updateKYC(userId);

    sendResponse(res, 200, {
      success: true,
      message: 'Verification reset. Please fill in your document details and upload again.',
      data: result,
    });
  } catch (error: any) {
    logger.error('Update KYC error', { error: error.message });
    const statusCode =
      error.message.includes('not found') ? 404 :
      error.message.includes('already') ? 400 :
      error.message.includes('Maximum') ? 400 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};
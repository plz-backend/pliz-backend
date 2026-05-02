import { Request, Response } from 'express';
import { KYCService } from '../services/kyc.service';
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
 * @route   POST /api/kyc/submit
 * @desc    Final submission — calls Prembly identity API
 * @access  Private
 */
export const submitKYC = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const result = await KYCService.submitKYC(userId);

    sendResponse(res, 200, {
      success: true,
      message: 'Verification submitted. Checking your identity — you will be notified shortly.',
      data: result,
    });
  } catch (error: any) {
    logger.error('Submit KYC error', { error: error.message });
    const statusCode =
      error.message.includes('not found') ? 404 :
      error.message.includes('phone') ? 400 :
      error.message.includes('document') ? 400 :
      error.message.includes('liveness') ? 400 :
      error.message.includes('already') ? 400 :
      error.message.includes('Maximum') ? 400 :
      error.message.includes('profile') ? 400 :
      error.message.includes('first name') ? 400 :
      error.message.includes('date of birth') ? 400 :
      error.message.includes('gender') ? 400 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};
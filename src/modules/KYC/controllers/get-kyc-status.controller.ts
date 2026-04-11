import { Request, Response } from 'express';
import { KYCService } from '../services/kyc.service';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

const sendResponse = <T = any>(res: Response, statusCode: number, response: IApiResponse<T>): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   GET /api/kyc/status
 * @desc    Get full KYC status including phone number from profile
 * @access  Private
 */
export const getKYCStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const status = await KYCService.getKYCStatus(userId);

    sendResponse(res, 200, {
      success: true,
      message: 'KYC status retrieved',
      data: status,
    });
  } catch (error: any) {
    logger.error('Get KYC status error', { error: error.message });
    sendResponse(res, 500, { success: false, message: 'Failed to get KYC status' });
  }
};
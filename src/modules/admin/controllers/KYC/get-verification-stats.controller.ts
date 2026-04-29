import { Request, Response } from 'express';
import { KYCService } from '../../../KYC/services/kyc.service';
import { IApiResponse } from '../../../auth/types/user.interface';
import logger from '../../../../config/logger';

const sendResponse = <T = any>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   GET /api/admin/kyc/stats
 * @access  Admin
 */
export const getVerificationStats = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const stats = await KYCService.getVerificationStats();

    sendResponse(res, 200, {
      success: true,
      message: 'Verification stats retrieved',
      data: stats,
    });
  } catch (error: any) {
    logger.error('Admin get stats error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to get stats',
    });
  }
};
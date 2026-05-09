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
 * @route   GET /api/admin/kyc
 * @desc    Get all KYC verifications with filters
 * @access  Admin
 * ?page=1&limit=20&status=under_review&verificationType=nin
 */
export const getAllVerifications = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string | undefined;
    const verificationType = req.query.verificationType as string | undefined;

    const result = await KYCService.getAllVerifications(
      page, limit, status, verificationType
    );

    sendResponse(res, 200, {
      success: true,
      message: 'Verifications retrieved',
      data: result,
    });
  } catch (error: any) {
    logger.error('Admin get all verifications error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to get verifications',
    });
  }
};
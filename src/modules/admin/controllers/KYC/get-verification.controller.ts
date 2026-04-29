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
 * @route   GET /api/admin/kyc/:userId
 * @desc    Get single user KYC with full details + document URLs
 * @access  Admin
 */
export const getVerification = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.params.userId as string;
    const result = await KYCService.getVerification(userId);

    sendResponse(res, 200, {
      success: true,
      message: 'Verification retrieved',
      data: result,
    });
  } catch (error: any) {
    logger.error('Admin get verification error', { error: error.message });
    const statusCode = error.message.includes('not found') ? 404 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};
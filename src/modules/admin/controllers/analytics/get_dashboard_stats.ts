import { Request, Response } from 'express';
import { AdminService } from '../../services/admin.service';
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
 * @route   GET /api/admin/dashboard/stats
 * @desc    Get admin dashboard statistics
 * @access  Admin
 */
export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await AdminService.getDashboardStats();

    sendResponse(res, 200, {
      success: true,
      message: 'Dashboard stats retrieved successfully',
      data: stats,
    });
  } catch (error: any) {
    logger.error('Get dashboard stats error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve dashboard stats',
    });
  }
};
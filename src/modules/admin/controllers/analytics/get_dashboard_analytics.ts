import { Request, Response } from 'express';
import { AdminService } from '../../services/admin.service';
import { IApiResponse } from '../../../auth/types/user.interface';
import logger from '../../../../config/logger';

const sendResponse = <T = unknown>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

export const getDashboardAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query.days as string, 10) || 30;
    const analytics = await AdminService.getDashboardAnalytics(days);

    sendResponse(res, 200, {
      success: true,
      message: 'Dashboard analytics retrieved',
      data: analytics,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load analytics';
    logger.error('Get dashboard analytics error', { error: message });
    sendResponse(res, 500, { success: false, message });
  }
};

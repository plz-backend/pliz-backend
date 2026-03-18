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
 * @route   GET /api/admin/users
 * @desc    Get all users with filters
 * @access  Admin
 */
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const suspended = req.query.suspended === 'true' ? true : 
                     req.query.suspended === 'false' ? false : undefined;
    const underInvestigation = req.query.underInvestigation === 'true' ? true :
                               req.query.underInvestigation === 'false' ? false : undefined;
    const role = req.query.role as string;

    const result = await AdminService.getAllUsers({
      page,
      limit,
      suspended,
      underInvestigation,
      role,
    });

    sendResponse(res, 200, {
      success: true,
      message: 'Users retrieved successfully',
      data: result,
    });
  } catch (error: any) {
    logger.error('Get users error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve users',
    });
  }
};
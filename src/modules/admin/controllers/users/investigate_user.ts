import { Request, Response } from 'express';
import { AdminService } from '../../services/admin.service';
import { IApiResponse } from '../../../auth/types/user.interface';
import logger from '../../../../config/logger';


interface UserParams {
  id: string;
}

const sendResponse = <T = any>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   POST /api/admin/users/:id/investigate
 * @desc    Put user under investigation
 * @access  Admin
 */
export const investigateUser = async (req: Request<UserParams>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = (req as any).user?.userId;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';

    if (!reason) {
      sendResponse(res, 400, {
        success: false,
        message: 'Investigation reason is required',
      });
      return;
    }

    await AdminService.investigateUser(id, reason, adminId, ip);

    sendResponse(res, 200, {
      success: true,
      message: 'User placed under investigation',
    });
  } catch (error: any) {
    logger.error('Investigate user error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: error.message || 'Failed to investigate user',
    });
  }
};
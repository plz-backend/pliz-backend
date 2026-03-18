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
 * @route   POST /api/admin/users/:id/unsuspend
 * @desc    Unsuspend a user account
 * @access  Admin
 */
export const unsuspendUser = async (req: Request<UserParams>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const adminId = (req as any).user?.userId;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';

    await AdminService.unsuspendUser(id, adminId, ip);

    sendResponse(res, 200, {
      success: true,
      message: 'User unsuspended successfully',
    });
  } catch (error: any) {
    logger.error('Unsuspend user error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: error.message || 'Failed to unsuspend user',
    });
  }
};
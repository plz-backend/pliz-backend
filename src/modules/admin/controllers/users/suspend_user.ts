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


// Define params interface
interface UserParams {
  id: string;
}

/**
 * @route   POST /api/admin/users/:id/suspend
 * @desc    Suspend a user account
 * @access  Admin
 */
export const suspendUser = async (req: Request<UserParams>, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminId = (req as any).user?.userId;
    const ip = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';

    if (!reason) {
      sendResponse(res, 400, {
        success: false,
        message: 'Suspension reason is required',
      });
      return;
    }

    // Prevent self-suspension
    if (id === adminId) {
      sendResponse(res, 400, {
        success: false,
        message: 'You cannot suspend your own account',
      });
      return;
    }

    await AdminService.suspendUser(id, reason, adminId, ip);

    sendResponse(res, 200, {
      success: true,
      message: 'User suspended successfully',
    });
  } catch (error: any) {
    logger.error('Suspend user error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: error.message || 'Failed to suspend user',
    });
  }
};
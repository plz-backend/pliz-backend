import { Request, Response } from 'express';
import { NotificationService } from '../services/notification.service';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

const sendResponse = <T = any>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   PUT /api/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Private
 */
export const markAllAsRead = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      sendResponse(res, 401, {
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    // If service returns void, don't assign to count
    await NotificationService.markAllAsRead(userId);

    sendResponse(res, 200, {
      success: true,
      message: 'All notifications marked as read',  // ✅ Simplified message
    });
  } catch (error: any) {
    logger.error('Mark all notifications as read error', { error: error.message });
    sendResponse(res, 500, { 
      success: false, 
      message: 'Failed to mark notifications as read' 
    });
  }
};
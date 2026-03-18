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
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
export const deleteNotification = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    
    // Check authentication
    if (!userId) {
      sendResponse(res, 401, {
        success: false,
        message: 'User not authenticated',
      });
      return;
    }

    // Handle string | string[] type
    const id = typeof req.params.id === 'string' 
      ? req.params.id 
      : req.params.id?.[0];

    if (!id) {
      sendResponse(res, 400, {
        success: false,
        message: 'Notification ID is required',
      });
      return;
    }

    await NotificationService.deleteNotification(id, userId);

    sendResponse(res, 200, {
      success: true,
      message: 'Notification deleted',
    });
  } catch (error: any) {
    logger.error('Delete notification error', { error: error.message });
    sendResponse(res, 500, { 
      success: false, 
      message: 'Failed to delete notification' 
    });
  }
};
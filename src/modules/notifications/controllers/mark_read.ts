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
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark notification as read
 * @access  Private
 */
export const markAsRead = async (
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

    await NotificationService.markAsRead(id, userId);

    sendResponse(res, 200, {
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error: any) {
    logger.error('Mark notification as read error', { error: error.message });
    sendResponse(res, 500, { 
      success: false, 
      message: 'Failed to mark notification as read' 
    });
  }
};
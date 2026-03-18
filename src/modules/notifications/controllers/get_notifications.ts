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
 * @route   GET /api/notifications
 * @desc    Get all notifications for current user
 * @access  Private
 */
export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await NotificationService.getUserNotifications(userId, page, limit);

    sendResponse(res, 200, {
      success: true,
      message: 'Notifications retrieved successfully',
      data: {
        notifications: result.notifications,
        unread_count: result.unread_count,
        pagination: { page, limit, total: result.total, pages: result.pages },
      },
    });
  } catch (error: any) {
    logger.error('Get notifications error', { error: error.message });
    sendResponse(res, 500, { success: false, message: 'Failed to retrieve notifications' });
  }
};

/**
 * @route   GET /api/notifications/unread-count
 * @desc    Get unread badge count
 * @access  Private
 */
export const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const count = await NotificationService.getUnreadCount(userId);

    sendResponse(res, 200, {
      success: true,
      message: 'Unread count retrieved',
      data: { unread_count: count },
    });
  } catch (error: any) {
    logger.error('Get unread count error', { error: error.message });
    sendResponse(res, 500, { success: false, message: 'Failed to get unread count' });
  }
};
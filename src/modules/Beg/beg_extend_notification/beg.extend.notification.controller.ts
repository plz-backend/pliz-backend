import { Request, Response } from 'express';
import { BegNotificationService } from '../beg_extend_notification/beg-notification.service';
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
 * @route   GET /api/begs/expiring
 * @desc    Get user's begs expiring within 1 hour (frontend uses this to show popup)
 * @access  Private
 */
export const getExpiringBegs = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    const expiringBegs = await BegNotificationService.getExpiringBegs(userId);

    // No expiring begs — no popup needed
    if (expiringBegs.length === 0) {
      sendResponse(res, 200, {
        success: true,
        message: 'No begs expiring soon',
        data: {
          hasExpiringBegs: false,
          begs: [],
        },
      });
      return;
    }

    sendResponse(res, 200, {
      success: true,
      message: `You have ${expiringBegs.length} beg${expiringBegs.length > 1 ? 's' : ''} expiring soon!`,
      data: {
        hasExpiringBegs: true,
        begs: expiringBegs,
      },
    });
  } catch (error: any) {
    logger.error('Get expiring begs error', { error: error.message });
    sendResponse(res, 500, { success: false, message: 'Failed to fetch expiring begs' });
  }
};
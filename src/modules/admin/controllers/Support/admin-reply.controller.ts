import { Request, Response } from 'express';
import { SupportService } from '../../../Support/services/support.service';
import { IApiResponse } from '../../../auth/types/user.interface';
import logger from '../../../../config/logger';

const sendResponse = <T = any>(res: Response, statusCode: number, response: IApiResponse<T>): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   POST /api/admin/support/tickets/:id/reply
 * @desc    Admin replies to ticket — notifies user in app + email
 * @access  Admin
 */
export const adminReply = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = (req as any).user?.userId;
    const ticketId = req.params.id as string;
    const { message } = req.body;

    await SupportService.adminReply(ticketId, adminId, message);

    sendResponse(res, 200, {
      success: true,
      message: 'Reply sent to user via app notification and email',
    });
  } catch (error: any) {
    logger.error('Admin reply error', { error: error.message });
    const statusCode = error.message.includes('not found') ? 404 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};
import { Request, Response } from 'express';
import { SupportService } from '../services/support.service';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

const sendResponse = <T = any>(res: Response, statusCode: number, response: IApiResponse<T>): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   POST /api/support/tickets/:id/reply
 * @desc    User replies to a ticket
 * @access  Private
 */
export const replyTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const ticketId = req.params.id as string;
    const { message } = req.body;

    const ticket = await SupportService.replyToTicket(ticketId, userId, message);

    sendResponse(res, 200, {
      success: true,
      message: 'Reply sent',
      data: { ticket },
    });
  } catch (error: any) {
    logger.error('Reply ticket error', { error: error.message });
    const statusCode =
      error.message.includes('not found') ? 404 :
      error.message.includes('Unauthorized') ? 403 :
      error.message.includes('closed') ? 400 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};
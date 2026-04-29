import { Request, Response } from 'express';
import { SupportService } from '../services/support.service';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

const sendResponse = <T = any>(res: Response, statusCode: number, response: IApiResponse<T>): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   GET /api/support/tickets/:id
 * @desc    Get single ticket with all messages
 * @access  Private
 */
export const getTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const ticketId = req.params.id as string;

    const ticket = await SupportService.getTicket(ticketId, userId);

    sendResponse(res, 200, {
      success: true,
      message: 'Ticket retrieved',
      data: { ticket },
    });
  } catch (error: any) {
    logger.error('Get ticket error', { error: error.message });
    const statusCode =
      error.message.includes('not found') ? 404 :
      error.message.includes('Unauthorized') ? 403 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};
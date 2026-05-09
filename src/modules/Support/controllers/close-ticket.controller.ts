import { Request, Response } from 'express';
import { SupportService } from '../services/support.service';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

const sendResponse = <T = any>(res: Response, statusCode: number, response: IApiResponse<T>): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   PATCH /api/support/tickets/:id/close
 * @desc    User closes their own ticket
 * @access  Private
 */
export const closeTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const ticketId = req.params.id as string;

    await SupportService.closeTicket(ticketId, userId);

    sendResponse(res, 200, {
      success: true,
      message: 'Ticket closed successfully',
    });
  } catch (error: any) {
    logger.error('Close ticket error', { error: error.message });
    const statusCode =
      error.message.includes('not found') ? 404 :
      error.message.includes('Unauthorized') ? 403 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};
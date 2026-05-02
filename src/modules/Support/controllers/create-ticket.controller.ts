import { Request, Response } from 'express';
import { SupportService } from '../services/support.service';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

const sendResponse = <T = any>(res: Response, statusCode: number, response: IApiResponse<T>): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   POST /api/support/tickets
 * @desc    Create a new support ticket
 * @access  Private
 */
export const createTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { subject, category, message, contactEmail } = req.body;

    const ticket = await SupportService.createTicket(userId, {
      subject,
      category,
      message,
      contactEmail,
    });

    sendResponse(res, 201, {
      success: true,
      message: `Ticket #${ticket.ticketNumber} created. We will reply to ${contactEmail} shortly.`,
      data: { ticket },
    });
  } catch (error: any) {
    logger.error('Create ticket error', { error: error.message });
    sendResponse(res, 500, { success: false, message: 'Failed to create ticket' });
  }
};
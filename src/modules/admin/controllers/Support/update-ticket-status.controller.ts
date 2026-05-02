import { Request, Response } from 'express';
import { SupportService } from '../../../Support/services/support.service';
import { IApiResponse } from '../../../auth/types/user.interface';
import { TicketStatus } from '../../../Support/types/support.interface';
import logger from '../../../../config/logger';

const sendResponse = <T = any>(res: Response, statusCode: number, response: IApiResponse<T>): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   PATCH /api/admin/support/tickets/:id/status
 * @desc    Update ticket status
 * @access  Admin
 */
export const updateTicketStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const ticketId = req.params.id as string;
    const { status } = req.body;

    const validStatuses = ['open', 'in_progress', 'waiting_user', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      sendResponse(res, 400, { success: false, message: 'Invalid status' });
      return;
    }

    await SupportService.updateTicketStatus(ticketId, status as TicketStatus);

    sendResponse(res, 200, {
      success: true,
      message: `Ticket status updated to ${status}`,
    });
  } catch (error: any) {
    logger.error('Update ticket status error', { error: error.message });
    sendResponse(res, 500, { success: false, message: 'Failed to update status' });
  }
};
import { Request, Response } from 'express';
import { SupportService } from '../../../Support/services/support.service';
import { IApiResponse } from '../../../auth/types/user.interface';
import logger from '../../../../config/logger';

const sendResponse = <T = any>(res: Response, statusCode: number, response: IApiResponse<T>): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   PATCH /api/admin/support/tickets/:id/assign
 * @desc    Assign ticket to admin/agent
 * @access  Admin
 */
export const assignTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = (req as any).user?.userId;
    const ticketId = req.params.id as string;

    await SupportService.assignTicket(ticketId, adminId);

    sendResponse(res, 200, {
      success: true,
      message: 'Ticket assigned to you successfully',
    });
  } catch (error: any) {
    logger.error('Assign ticket error', { error: error.message });
    sendResponse(res, 500, { success: false, message: 'Failed to assign ticket' });
  }
};
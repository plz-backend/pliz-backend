import { Request, Response } from 'express';
import { SupportService } from '../../../Support/services/support.service';
import { IApiResponse } from '../../../auth/types/user.interface';
import logger from '../../../../config/logger';

const sendResponse = <T = any>(res: Response, statusCode: number, response: IApiResponse<T>): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   GET /api/admin/support/tickets
 * @desc    Get all tickets — admin
 * @access  Admin
 */
export const getAllTickets = async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const category = req.query.category as string;
    const priority = req.query.priority as string;

    const result = await SupportService.getAllTickets(page, limit, status, category, priority);

    sendResponse(res, 200, {
      success: true,
      message: 'Tickets retrieved',
      data: result,
    });
  } catch (error: any) {
    logger.error('Get all tickets error', { error: error.message });
    sendResponse(res, 500, { success: false, message: 'Failed to get tickets' });
  }
};
import { Request, Response } from 'express';
import { SupportService } from '../services/support.service';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

const sendResponse = <T = any>(res: Response, statusCode: number, response: IApiResponse<T>): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   GET /api/support/tickets
 * @desc    Get all tickets for current user
 * @access  Private
 */
export const getTickets = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await SupportService.getUserTickets(userId, page, limit);

    sendResponse(res, 200, {
      success: true,
      message: 'Tickets retrieved',
      data: result,
    });
  } catch (error: any) {
    logger.error('Get tickets error', { error: error.message });
    sendResponse(res, 500, { success: false, message: 'Failed to get tickets' });
  }
};
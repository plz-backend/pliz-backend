import { Request, Response } from 'express';
import { MessageService } from '../services/message.service';
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
 * @route   GET /api/donations/messages/received
 * @desc    Donor sees all thank you messages received from recipients
 * @access  Private
 */
export const getDonorMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const donorId = (req as any).user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await MessageService.getDonorMessages(donorId, page, limit);

    sendResponse(res, 200, {
      success: true,
      message: 'Messages retrieved successfully',
      data: {
        messages: result.messages,
        pagination: { page, limit, total: result.total, pages: result.pages },
      },
    });
  } catch (error: any) {
    logger.error('Get donor messages error', { error: error.message });
    sendResponse(res, 500, { success: false, message: 'Failed to retrieve messages' });
  }
};

/**
 * @route   GET /api/donations/messages/sent
 * @desc    Recipient sees all gratitude messages they have sent
 * @access  Private
 */
export const getRecipientMessages = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await MessageService.getRecipientSentMessages(userId, page, limit);

    sendResponse(res, 200, {
      success: true,
      message: 'Messages retrieved successfully',
      data: {
        messages: result.messages,
        pagination: { page, limit, total: result.total, pages: result.pages },
      },
    });
  } catch (error: any) {
    logger.error('Get recipient messages error', { error: error.message });
    sendResponse(res, 500, { success: false, message: 'Failed to retrieve messages' });
  }
};
import { Request, Response } from 'express';
import { AIChatService } from '../services/ai-chat.service';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

const sendResponse = <T = any>(res: Response, statusCode: number, response: IApiResponse<T>): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   POST /api/support/chat
 * @desc    Send message to AI support
 * @access  Private
 */
export const aiChat = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { message, sessionId } = req.body;

    const result = await AIChatService.chat(userId, message, sessionId);

    sendResponse(res, 200, {
      success: true,
      message: 'Message sent',
      data: result,
    });
  } catch (error: any) {
    logger.error('AI chat error', { error: error.message });
    sendResponse(res, 500, { success: false, message: 'Failed to process message. Please try again.' });
  }
};
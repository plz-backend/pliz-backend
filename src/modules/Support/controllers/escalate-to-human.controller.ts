import { Request, Response } from 'express';
import { AIChatService } from '../services/ai-chat.service';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

const sendResponse = <T = any>(res: Response, statusCode: number, response: IApiResponse<T>): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   POST /api/support/chat/escalate
 * @desc    Escalate AI chat to human support
 * @access  Private
 */
export const escalateToHuman = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { sessionId, subject, category, contactEmail } = req.body;

    const result = await AIChatService.escalateToHuman(
      userId,
      sessionId,
      subject,
      category || 'other',
      contactEmail
    );

    sendResponse(res, 200, {
      success: true,
      message: `Ticket #${result.ticketNumber} created. Our support team will reply to ${contactEmail} shortly.`,
      data: result,
    });
  } catch (error: any) {
    logger.error('Escalation error', { error: error.message });
    const statusCode =
      error.message.includes('not found') ? 404 :
      error.message.includes('already been escalated') ? 400 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};
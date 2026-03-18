// import { Request, Response } from 'express';
// import { SessionService } from '../../services/session.service';
// import { ISessionResponse, IApiResponse } from '../../types/user.interface';
// import logger from '../../../../config/logger';

import { Request, Response } from 'express';
import { SessionService } from '../../services/session.service';
import { IApiResponse } from '../../types/user.interface';
import logger from '../../../../config/logger';

/**
 * Helper to send response
 */
const sendResponse = <T = any>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   GET /api/sessions
 * @desc    Get all active sessions for current user
 * @access  Private
 */
export const getSessions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const currentSessionId = req.user?.sessionId;

    if (!userId) {
      const response: IApiResponse = {
        success: false,
        message: 'User not authenticated',
      };
      sendResponse(res, 401, response);
      return;
    }

    logger.info('Get sessions request', { userId });

    // This already returns ISessionResponse[] - no need for additional formatting
    const sessions = await SessionService.getUserSessions(userId, currentSessionId);

    logger.info('Sessions retrieved', {
      userId,
      sessionCount: sessions.length,
    });

    const response: IApiResponse = {
      success: true,
      message: 'Sessions retrieved successfully',
      data: { sessions }, // Use directly
    };
    
    sendResponse(res, 200, response);
  } catch (error: any) {
    logger.error('Get sessions error', {
      error: error.message,
      stack: error.stack,
    });

    const response: IApiResponse = {
      success: false,
      message: 'Failed to retrieve sessions',
    };
    sendResponse(res, 500, response);
  }
};

// ========== SESSION: Logout from a specific session (device) ==========

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
 * @route   DELETE /api/sessions/:sessionId
 * @desc    Logout from a specific session (device)
 * @access  Private
 */
export const deleteSession = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    // ✅ FIX: Handle string | string[] type
    const sessionId = typeof req.params.sessionId === 'string' 
      ? req.params.sessionId 
      : req.params.sessionId[0];

    if (!userId) {
      const response: IApiResponse = {
        success: false,
        message: 'Unauthorized',
      };
      sendResponse(res, 401, response);
      return;
    }

    if (!sessionId) {
      const response: IApiResponse = {
        success: false,
        message: 'Session ID is required',
      };
      sendResponse(res, 400, response);
      return;
    }

    // Get session to verify ownership
    const session = await SessionService.getSessionById(sessionId);

    if (!session) {
      const response: IApiResponse = {
        success: false,
        message: 'Session not found',
      };
      sendResponse(res, 404, response);
      return;
    }

    // Verify the session belongs to the user
    if (session.userId !== userId) {
      const response: IApiResponse = {
        success: false,
        message: 'Access denied',
      };
      sendResponse(res, 403, response);
      return;
    }

    // Deactivate the session
    const success = await SessionService.deactivateSession(sessionId);

    if (!success) {
      const response: IApiResponse = {
        success: false,
        message: 'Failed to logout from session',
      };
      sendResponse(res, 500, response);
      return;
    }

    logger.info('Session deleted', { userId, sessionId });

    const response: IApiResponse = {
      success: true,
      message: 'Logged out from session successfully',
    };

    sendResponse(res, 200, response);
  } catch (error: any) {
    logger.error('Delete session error', {
      error: error.message,
      stack: error.stack,
    });

    const response: IApiResponse = {
      success: false,
      message: 'Failed to logout from session',
    };
    sendResponse(res, 500, response);
  }
};
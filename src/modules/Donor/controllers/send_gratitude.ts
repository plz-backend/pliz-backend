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
 * @route   POST /api/donations/:donationId/gratitude
 * @desc    Recipient sends thank you message to donor
 * @access  Private (recipient only)
 */
export const sendGratitude = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    
    //  Validate userId first
    if (!userId) {
      sendResponse(res, 401, { 
        success: false, 
        message: 'User not authenticated' 
      });
      return;
    }
    
    //  Handle string | string[] type
    const donationId = typeof req.params.donationId === 'string'
      ? req.params.donationId
      : req.params.donationId?.[0];

    if (!donationId) {
      sendResponse(res, 400, { 
        success: false, 
        message: 'Donation ID is required' 
      });
      return;
    }

    const { content, donorReplyAllowed } = req.body;

    if (!content || !content.trim()) {
      sendResponse(res, 400, { 
        success: false, 
        message: 'Message content is required' 
      });
      return;
    }

    if (content.trim().length > 500) {
      sendResponse(res, 400, { 
        success: false, 
        message: 'Message cannot exceed 500 characters' 
      });
      return;
    }

    //  Now userId is guaranteed to be string
    const message = await MessageService.sendGratitudeMessage(donationId, userId, {
      messageType: 1,                         // Text only for now
      content: content.trim(),
      donorReplyAllowed: donorReplyAllowed !== false,
    });

    sendResponse(res, 201, {
      success: true,
      message: 'Gratitude message sent successfully',
      data: { message },
    });
  } catch (error: any) {
    logger.error('Send gratitude error', { error: error.message });
    sendResponse(res, 400, {
      success: false,
      message: error.message || 'Failed to send gratitude message',
    });
  }
};
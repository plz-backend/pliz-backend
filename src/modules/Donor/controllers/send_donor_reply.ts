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
 * @route   POST /api/donations/:donationId/reply
 * @desc    Donor replies to gratitude message (once, within 24hrs)
 * @access  Private (donor only)
 */
export const sendDonorReply = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const donorId = req.user?.userId;
    
    //  Check if user is authenticated
    if (!donorId) {
      sendResponse(res, 401, { 
        success: false, 
        message: 'User not authenticated' 
      });
      return;
    }
    
    // Handle string | string[] type
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

    const { reply } = req.body;

    if (!reply || !reply.trim()) {
      sendResponse(res, 400, { 
        success: false, 
        message: 'Reply message is required' 
      });
      return;
    }

    if (reply.trim().length > 500) {
      sendResponse(res, 400, { 
        success: false, 
        message: 'Reply cannot exceed 500 characters' 
      });
      return;
    }

    // Now donorId is guaranteed to be string
    const message = await MessageService.sendDonorReply(donationId, donorId, reply.trim());

    sendResponse(res, 200, {
      success: true,
      message: 'Reply sent successfully',
      data: { message },
    });
  } catch (error: any) {
    logger.error('Send donor reply error', { error: error.message });
    sendResponse(res, 400, {
      success: false,
      message: error.message || 'Failed to send reply',
    });
  }
};
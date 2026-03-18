import { Request, Response } from 'express';
import { BegService } from '../services/beg.service';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

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
 * @route   DELETE /api/begs/:id
 * @desc    Cancel user's own beg
 * @access  Private
 */
export const cancelBeg = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    
    // Ensure id is a string
    const id = Array.isArray(req.params.id) 
      ? req.params.id[0] 
      : req.params.id;

    if (!id) {
      const response: IApiResponse = {
        success: false,
        message: 'Beg ID is required',
      };
      sendResponse(res, 400, response);
      return;
    }

    logger.info('Cancel beg request', { userId, begId: id });

    await BegService.cancelBeg(userId, id);

    logger.info('Beg cancelled successfully', { userId, begId: id });

    const response: IApiResponse = {
      success: true,
      message: 'Beg cancelled successfully',
    };

    sendResponse(res, 200, response);
  } catch (error: any) {
    logger.error('Cancel beg error', {
      error: error.message,
      stack: error.stack,
    });

    const response: IApiResponse = {
      success: false,
      message: error.message || 'Failed to cancel beg',
    };

    sendResponse(res, 400, response);
  }
};
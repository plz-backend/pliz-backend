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
 * @route   GET /api/begs/:id
 * @desc    Get single beg by ID
 * @access  Public
 */
export const getBegById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    // ✅ Fix: Ensure id is a string
    const id = Array.isArray(req.params.id) 
      ? req.params.id[0] 
      : req.params.id;

    if (!id) {
      const response: IApiResponse = {
        success: false,
        message: 'Beg ID is required',
      };
      sendResponse(res, 404, response);
      return;
    }

    logger.info('Get beg by ID request', { begId: id });

    const beg = await BegService.getBegById(id);

    if (!beg) {
      const response: IApiResponse = {
        success: false,
        message: 'Beg not found',
      };
      sendResponse(res, 404, response);
      return;
    }

    const response: IApiResponse = {
      success: true,
      message: 'Beg retrieved successfully',
      data: { beg },
    };

    sendResponse(res, 200, response);
  } catch (error: any) {
    logger.error('Get beg by ID error', {
      error: error.message,
      stack: error.stack,
    });

    const response: IApiResponse = {
      success: false,
      message: 'Failed to retrieve beg',
    };

    sendResponse(res, 500, response);
  }
};
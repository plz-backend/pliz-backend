import { Request, Response } from 'express';
import { DonationService } from '../services/donation.service';
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
 * @route   GET /api/donations/beg/:begId
 * @desc    Get all donations for a specific beg
 * @access  Public
 */
export const getBegDonations = async (
  req: Request, 
  res: Response
): Promise<void> => {
  try {
    // Handle string | string[] type
    const begId = typeof req.params.begId === 'string' 
      ? req.params.begId 
      : req.params.begId?.[0];

    if (!begId) {
      sendResponse(res, 400, {
        success: false,
        message: 'Beg ID is required',
      });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await DonationService.getDonationsByBeg(begId, page, limit);

    sendResponse(res, 200, {
      success: true,
      message: 'Donations retrieved successfully',
      data: {
        donations: result.donations,
        pagination: { page, limit, total: result.total, pages: result.pages },
      },
    });
  } catch (error: any) {
    logger.error('Get beg donations error', { error: error.message });
    sendResponse(res, 500, { 
      success: false, 
      message: 'Failed to retrieve donations' 
    });
  }
};
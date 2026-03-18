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
 * @route   GET /api/donations/my-donations
 * @desc    Get donor's full donation history
 * @access  Private
 */
export const getMyDonations = async (req: Request, res: Response): Promise<void> => {
  try {
    const donorId = (req as any).user?.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await DonationService.getMyDonations(donorId, page, limit);

    sendResponse(res, 200, {
      success: true,
      message: 'Donation history retrieved successfully',
      data: {
        donations: result.donations,
        pagination: { page, limit, total: result.total, pages: result.pages },
      },
    });
  } catch (error: any) {
    logger.error('Get my donations error', { error: error.message });
    sendResponse(res, 500, { success: false, message: 'Failed to retrieve donation history' });
  }
};
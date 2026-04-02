import { Request, Response } from 'express';
import { BegService } from '../services/beg.service';
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
 * @route   PUT /api/begs/:id/extend
 * @desc    Extend a beg's expiry duration (user selects from popup)
 * @access  Private (Owner only)
 */
export const extendBeg = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const begId = typeof req.params.id === 'string' ? req.params.id : req.params.id[0];
    const { expiryHours } = req.body;

    if (!userId) {
      sendResponse(res, 401, { success: false, message: 'User not authenticated' });
      return;
    }

    if (!begId) {
      sendResponse(res, 400, { success: false, message: 'Beg ID is required' });
      return;
    }

    if (!expiryHours) {
      sendResponse(res, 400, {
        success: false,
        message: 'Please select an expiry option',
        errors: [{ field: 'expiryHours', message: 'Expiry hours is required' }],
      });
      return;
    }

    if (![24, 72, 168].includes(expiryHours)) {
      sendResponse(res, 400, {
        success: false,
        message: 'Invalid expiry option selected',
        errors: [{
          field: 'expiryHours',
          message: 'Expiry must be 24 hours, 72 hours, or 7 days (168 hours)',
        }],
      });
      return;
    }

    logger.info('Beg extend request', { begId, userId, expiryHours });

    const beg = await BegService.extendBeg(begId, userId, expiryHours);

    // Build a human-readable label for the response
    const expiryLabel =
      expiryHours === 24 ? '24 hours' :
      expiryHours === 72 ? '72 hours' :
      '7 days';

    sendResponse(res, 200, {
      success: true,
      message: `Beg successfully extended to ${expiryLabel}!`,
      data: {
        beg: {
          id: beg.id,
          expiryHours: beg.expiryHours,
          expiresAt: beg.expiresAt,
          status: beg.status,
        },
        // Return available options so frontend can update the popup accordingly
        availableExtensions: [24, 72, 168]
          .filter(h => h > beg.expiryHours)
          .map(h => ({
            hours: h,
            label: h === 24 ? '24 hours' : h === 72 ? '72 hours' : '7 days',
          })),
      },
    });
  } catch (error: any) {
    logger.error('Extend beg error', {
      error: error.message,
      stack: error.stack,
      userId: (req as any).user?.userId,
      begId: req.params.id,
    });

    const statusCode =
      error.message.includes('Unauthorized') ? 403 :
      error.message.includes('not found') ? 404 :
      error.message.includes('greater than') || error.message.includes('Invalid') ? 400 :
      error.message.includes('active') ? 400 :
      500;

    sendResponse(res, statusCode, {
      success: false,
      message: error.message || 'Failed to extend beg',
    });
  }
};
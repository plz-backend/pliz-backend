import { Request, Response } from 'express';
import { PaymentMethodService } from '../services/payment_method.service';
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
 * @route   GET /api/payment-methods/cards
 * @desc    Get user's saved cards
 * @access  Private
 */
export const getCards = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    const cards = await PaymentMethodService.getUserCards(userId);

    sendResponse(res, 200, {
      success: true,
      message: 'Cards retrieved successfully',
      data: { cards },
    });
  } catch (error: any) {
    logger.error('Get cards error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to retrieve cards',
    });
  }
};
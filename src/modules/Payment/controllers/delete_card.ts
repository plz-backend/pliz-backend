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

interface CardParams {
  id: string;
}

/**
 * @route   DELETE /api/payment-methods/cards/:id
 * @desc    Delete saved card
 * @access  Private
 */
export const deleteCard = async (
  req: Request<CardParams>,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params;

    await PaymentMethodService.deleteCard(userId, id);

    sendResponse(res, 200, {
      success: true,
      message: 'Card deleted successfully',
    });
  } catch (error: any) {
    logger.error('Delete card error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: error.message || 'Failed to delete card',
    });
  }
};
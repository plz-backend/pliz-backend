import { Request, Response } from 'express';
import { EmojiService } from '../services/emoji.service';
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
 * @route   GET /api/reactions/emojis
 * @desc    Get all available emojis grouped by category
 * @access  Private
 */
export const getAvailableEmojis = async (req: Request, res: Response): Promise<void> => {
  try {
    const emojis = await EmojiService.getAllEmojis();
    const totalEmojis = emojis.reduce((sum, cat) => sum + cat.emojis.length, 0);

    sendResponse(res, 200, {
      success: true,
      message: 'Emojis retrieved',
      data: {
        categories: emojis,
        totalEmojis,
        totalCategories: emojis.length,
      },
    });
  } catch (error: any) {
    logger.error('Get emojis error', { error: error.message });
    sendResponse(res, 500, { success: false, message: 'Failed to get emojis' });
  }
};
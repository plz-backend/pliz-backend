import { Request, Response } from 'express';
import { ReactionService } from '../services/reaction.service';
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
 * @route   POST /api/reactions
 * @desc    Add, change or remove a reaction
 *          No reaction  → adds it
 *          Same emoji   → removes it (unreact)
 *          New emoji    → replaces existing
 * @access  Private
 */
export const addReaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { emoji, targetType, targetId } = req.body;

    const result = await ReactionService.addReaction(userId, {
      emoji,
      targetType,
      targetId,
    });

    sendResponse(res, 200, {
      success: true,
      message: 'Reaction updated',
      data: result,
    });
  } catch (error: any) {
    logger.error('Add reaction error', { error: error.message });
    const statusCode =
      error.message.includes('not found') ? 404 :
      error.message.includes('Invalid emoji') ? 400 :
      error.message.includes('Cannot react') ? 400 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};
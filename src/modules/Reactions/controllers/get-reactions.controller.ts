import { Request, Response } from 'express';
import { ReactionService } from '../services/reaction.service';
import { IApiResponse } from '../../auth/types/user.interface';
import { ReactionTarget } from '../types/reaction.interface';
import logger from '../../../config/logger';

const sendResponse = <T = any>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   GET /api/reactions/:targetType/:targetId
 * @desc    Get all reactions for a beg or donation
 * @access  Private
 */
export const getReactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const targetType = req.params.targetType as string;
    const targetId = req.params.targetId as string;   // ← cast to string

    if (!['beg', 'donation'].includes(targetType)) {
      sendResponse(res, 400, {
        success: false,
        message: 'targetType must be beg or donation',
      });
      return;
    }

    const result = await ReactionService.getReactions(
      targetType as ReactionTarget,
      targetId,
      userId
    );

    sendResponse(res, 200, {
      success: true,
      message: 'Reactions retrieved',
      data: result,
    });
  } catch (error: any) {
    logger.error('Get reactions error', { error: error.message });
    sendResponse(res, 500, { success: false, message: 'Failed to get reactions' });
  }
};
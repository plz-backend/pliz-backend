import { Request, Response } from 'express';
import { ProfilePictureService } from '../services/profile-picture.service';
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
 * @route   DELETE /api/profile-picture
 * @desc    Remove profile picture and go back to avatar
 * @access  Private
 */
export const removePicture = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const result = await ProfilePictureService.removePicture(userId);

    sendResponse(res, 200, {
      success: true,
      message: 'Profile picture removed',
      data: result,
    });
  } catch (error: any) {
    logger.error('Remove picture error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to remove profile picture',
    });
  }
};
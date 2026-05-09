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
 * @route   GET /api/profile-picture
 * @desc    Get current user avatar
 * @access  Private
 */
export const getAvatar = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const result = await ProfilePictureService.getAvatar(userId);

    sendResponse(res, 200, {
      success: true,
      message: 'Avatar retrieved',
      data: result,
    });
  } catch (error: any) {
    logger.error('Get avatar error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to get avatar',
    });
  }
};

/**
 * @route   GET /api/profile-picture/options
 * @desc    Get available colors and library avatars
 * @access  Private
 */
export const getAvatarOptions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const options = ProfilePictureService.getAvatarOptions();

    sendResponse(res, 200, {
      success: true,
      message: 'Avatar options retrieved',
      data: options,
    });
  } catch (error: any) {
    logger.error('Get avatar options error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to get avatar options',
    });
  }
};
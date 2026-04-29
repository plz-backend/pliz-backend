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
 * @route   POST /api/profile-picture/avatar/initials
 * @desc    Set initials avatar with chosen color
 * @access  Private
 */
export const setInitialsAvatar = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { color } = req.body;

    const result = await ProfilePictureService.setInitialsAvatar(userId, color);

    sendResponse(res, 200, {
      success: true,
      message: 'Avatar updated successfully',
      data: result,
    });
  } catch (error: any) {
    logger.error('Set initials avatar error', { error: error.message });
    const statusCode = error.message.includes('Invalid') ? 400 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};

/**
 * @route   POST /api/profile-picture/avatar/library
 * @desc    Set avatar from library
 * @access  Private
 */
export const setLibraryAvatar = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { avatarId } = req.body;

    const result = await ProfilePictureService.setLibraryAvatar(userId, avatarId);

    sendResponse(res, 200, {
      success: true,
      message: 'Avatar updated successfully',
      data: result,
    });
  } catch (error: any) {
    logger.error('Set library avatar error', { error: error.message });
    const statusCode = error.message.includes('Invalid') ? 400 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};
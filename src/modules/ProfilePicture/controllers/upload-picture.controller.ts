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
 * @route   POST /api/profile-picture/upload
 * @desc    Upload profile picture from gallery or camera
 * @access  Private
 */
export const uploadPicture = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    if (!req.file) {
      sendResponse(res, 400, {
        success: false,
        message: 'Please select an image to upload',
      });
      return;
    }

    const result = await ProfilePictureService.uploadPicture(
      userId,
      req.file.buffer,
      req.file.mimetype
    );

    sendResponse(res, 200, {
      success: true,
      message: 'Profile picture updated successfully',
      data: result,
    });
  } catch (error: any) {
    logger.error('Upload picture error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to upload profile picture',
    });
  }
};
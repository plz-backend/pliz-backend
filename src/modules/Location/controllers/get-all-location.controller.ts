import { Request, Response } from 'express';
import { LocationService } from '../services/location.service';
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
 * @route   GET /api/location/all
 * @desc    Get everything in one call — states + lgas + passport offices
 * @access  Private
 */
export const getAllLocationData = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const data = await LocationService.getAllLocationData();

    sendResponse(res, 200, {
      success: true,
      message: 'Location data retrieved',
      data,
    });
  } catch (error: any) {
    logger.error('Get all location data error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to get location data',
    });
  }
};
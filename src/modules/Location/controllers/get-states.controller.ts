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
 * @route   GET /api/location/states
 * @desc    Get all 37 Nigerian states
 * @access  Private
 */
export const getNigerianStates = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const states = await LocationService.getNigerianStates();

    sendResponse(res, 200, {
      success: true,
      message: 'States retrieved',
      data: { states },
    });
  } catch (error: any) {
    logger.error('Get states error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to get states',
    });
  }
};
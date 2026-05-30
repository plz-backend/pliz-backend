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
 * @route   GET /api/location/passport-offices
 * @desc    Get all NIS passport issuing offices
 * @access  Private
 */
export const getPassportOffices = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const offices = await LocationService.getPassportIssuingOffices();

    sendResponse(res, 200, {
      success: true,
      message: 'Passport offices retrieved',
      data: { offices },
    });
  } catch (error: any) {
    logger.error('Get passport offices error', { error: error.message });
    sendResponse(res, 500, {
      success: false,
      message: 'Failed to get passport offices',
    });
  }
};
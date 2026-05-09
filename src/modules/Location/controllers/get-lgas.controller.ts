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
 * @route   GET /api/location/lgas/:state
 * @desc    Get LGAs for a specific state e.g. /lgas/Lagos
 * @access  Private
 */
export const getLGAs = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const state = req.params.state as string;

    if (!state) {
      sendResponse(res, 400, {
        success: false,
        message: 'State is required',
      });
      return;
    }

    const lgas = await LocationService.getLGAsForState(state);

    sendResponse(res, 200, {
      success: true,
      message: 'LGAs retrieved',
      data: { state, lgas },
    });
  } catch (error: any) {
    logger.error('Get LGAs error', { error: error.message });
    const statusCode = error.message.includes('not found') ? 404 : 500;
    sendResponse(res, statusCode, {
      success: false,
      message: error.message,
    });
  }
};
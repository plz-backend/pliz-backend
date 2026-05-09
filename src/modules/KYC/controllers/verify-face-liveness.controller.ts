import { Request, Response } from 'express';
import { FaceLivenessService } from '../services/face-liveness.service';
import { IApiResponse } from '../../auth/types/user.interface';
import logger from '../../../config/logger';

const sendResponse = <T = any>(res: Response, statusCode: number, response: IApiResponse<T>): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   POST /api/kyc/face-liveness
 * @desc    Verify face liveness — user takes selfie
 * @access  Private
 */
export const verifyFaceLiveness = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    const { image } = req.body;

    if (!image) {
      sendResponse(res, 400, {
        success: false,
        message: 'Image is required. Please take a selfie.',
      });
      return;
    }

    const result = await FaceLivenessService.verifyFaceLiveness(userId, image);

    if (!result.passed) {
      sendResponse(res, 400, {
        success: false,
        message: result.error || 'Face liveness check failed. Please try again.',
        data: { score: result.score },
      });
      return;
    }

    sendResponse(res, 200, {
      success: true,
      message: 'Face liveness check passed! Please submit your verification.',
      data: { passed: result.passed, score: result.score },
    });
  } catch (error: any) {
    logger.error('Face liveness error', { error: error.message });
    const statusCode =
      error.message.includes('phone') ? 400 :
      error.message.includes('document') ? 400 :
      error.message.includes('already verified') ? 400 : 500;
    sendResponse(res, statusCode, { success: false, message: error.message });
  }
};
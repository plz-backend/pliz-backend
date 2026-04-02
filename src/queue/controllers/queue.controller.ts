import { Request, Response } from 'express';
import { getQueueHealth } from '../../config/queue-manager';
import { IApiResponse } from '../../modules/auth/types/user.interface';
import logger from '../../config/logger';

const sendResponse = <T = any>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   GET /api/admin/queues/health
 * @desc    Get health of all queues
 * @access  Admin
 */
export const getQueuesHealth = async (req: Request, res: Response): Promise<void> => {
  try {
    const health = await getQueueHealth();

    sendResponse(res, 200, {
      success: true,
      message: 'Queue health retrieved',
      data: { queues: health },
    });
  } catch (error: any) {
    logger.error('Failed to get queue health', { error: error.message });
    sendResponse(res, 500, { success: false, message: 'Failed to get queue health' });
  }
};
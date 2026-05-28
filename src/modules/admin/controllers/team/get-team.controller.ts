import { Request, Response } from 'express';
import { AdminTeamService } from '../../services/admin-team.service';
import { IApiResponse } from '../../../auth/types/user.interface';
import logger from '../../../../config/logger';

const sendResponse = <T = unknown>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

export const getTeamMembers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const members = await AdminTeamService.listTeamMembers();
    sendResponse(res, 200, {
      success: true,
      message: 'Team members retrieved',
      data: { members },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to list team';
    logger.error('Get team members error', { error: message });
    sendResponse(res, 500, { success: false, message });
  }
};

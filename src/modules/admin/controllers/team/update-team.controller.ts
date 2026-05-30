import { Request, Response } from 'express';
import { AdminStaffRole } from '@prisma/client';
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

export const updateTeamMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const actorId = req.user!.userId;
    const memberId = String(req.params.id);
    const { adminStaffRole, isTeamDisabled } = req.body as {
      adminStaffRole?: AdminStaffRole;
      isTeamDisabled?: boolean;
    };

    await AdminTeamService.updateMember({
      memberId,
      adminStaffRole,
      isTeamDisabled,
      actorId,
    });

    sendResponse(res, 200, {
      success: true,
      message: 'Team member updated',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update team member';
    logger.error('Update team member error', { error: message });
    sendResponse(res, 400, { success: false, message });
  }
};

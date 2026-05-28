import { Request, Response } from 'express';
import { AdminStaffRole } from '@prisma/client';
import { AdminTeamService } from '../../services/admin-team.service';
import { AdminService } from '../../services/admin.service';
import { IApiResponse } from '../../../auth/types/user.interface';
import logger from '../../../../config/logger';

const sendResponse = <T = unknown>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

const VALID_ROLES: AdminStaffRole[] = [
  AdminStaffRole.operations,
  AdminStaffRole.support,
  AdminStaffRole.finance,
  AdminStaffRole.viewer,
];

export const inviteTeamMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminId = req.user!.userId;
    const { email, adminStaffRole } = req.body as {
      email?: string;
      adminStaffRole?: AdminStaffRole;
    };

    if (!email?.trim() || !adminStaffRole) {
      sendResponse(res, 400, { success: false, message: 'Email and role are required' });
      return;
    }

    if (!VALID_ROLES.includes(adminStaffRole)) {
      sendResponse(res, 400, { success: false, message: 'Invalid staff role' });
      return;
    }

    const frontendUrl =
      process.env.ADMIN_FRONTEND_URL ||
      process.env.FRONTEND_URL?.split(',')[0]?.trim() ||
      'http://localhost:5174';

    const result = await AdminTeamService.createInvite({
      email,
      adminStaffRole,
      invitedById: adminId,
      frontendUrl,
    });

    await AdminService.logAction({
      adminId,
      actionType: 'team_invite_created',
      description: `Invited ${result.email} as ${adminStaffRole}`,
      metadata: { email: result.email, adminStaffRole, expiresAt: result.expiresAt },
      ipAddress: req.ip,
    });

    sendResponse(res, 201, {
      success: true,
      message: 'Invite created. Share the link with your teammate.',
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create invite';
    logger.error('Invite team member error', { error: message });
    sendResponse(res, 400, { success: false, message });
  }
};

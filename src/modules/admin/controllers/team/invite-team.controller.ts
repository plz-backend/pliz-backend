import { Request, Response } from 'express';
import { AdminStaffRole } from '@prisma/client';
import prisma from '../../../../config/database';
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

    const inviter = await prisma.user.findUnique({
      where: { id: adminId },
      select: { email: true },
    });

    const result = await AdminTeamService.createInvite({
      email,
      adminStaffRole,
      invitedById: adminId,
      invitedByEmail: inviter?.email,
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
      message: `Invite email sent to ${result.email}. It expires in 48 hours.`,
      data: result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to create invite';
    logger.error('Invite team member error', { error: message });
    const isEmailError = message.includes('Failed to send invite email');
    sendResponse(res, isEmailError ? 502 : 400, {
      success: false,
      message: isEmailError
        ? 'Could not send the invite email. Check email configuration and try again.'
        : message,
    });
  }
};

import crypto from 'crypto';
import prisma from '../../../config/database';
import { AdminStaffRole, UserRole } from '@prisma/client';
import { UserService } from '../../auth/services/user.service';
import { AdminService } from './admin.service';
import {
  permissionsForUser,
  resolveAdminStaffRole,
  STAFF_ROLE_LABELS,
} from '../permissions';
import { EmailService, getAdminFrontendBaseUrl } from '../../auth/services/emailService';
import logger from '../../../config/logger';

const INVITE_TTL_HOURS = 48;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function usernameFromEmail(email: string): string {
  const base = email.split('@')[0].replace(/[^a-z0-9_]/gi, '_').toLowerCase().slice(0, 40);
  return base.length >= 3 ? base : `admin_${base}`;
}

export class AdminTeamService {
  static async listTeamMembers(): Promise<
    Array<{
      id: string;
      email: string;
      username: string;
      role: UserRole;
      adminStaffRole: AdminStaffRole | null;
      staffRoleLabel: string;
      mustChangePassword: boolean;
      isTeamDisabled: boolean;
      lastLoginHint: string | null;
      createdAt: Date;
    }>
  > {
    const members = await prisma.user.findMany({
      where: { role: { in: [UserRole.admin, UserRole.superadmin] } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        adminStaffRole: true,
        mustChangePassword: true,
        isTeamDisabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return members.map((m) => {
      const staffRole = resolveAdminStaffRole(m);
      return {
        id: m.id,
        email: m.email,
        username: m.username,
        role: m.role,
        adminStaffRole: staffRole,
        staffRoleLabel: staffRole ? STAFF_ROLE_LABELS[staffRole] : 'Staff',
        mustChangePassword: m.mustChangePassword,
        isTeamDisabled: m.isTeamDisabled,
        lastLoginHint: null,
        createdAt: m.createdAt,
      };
    });
  }

  static async createInvite(input: {
    email: string;
    adminStaffRole: AdminStaffRole;
    invitedById: string;
    invitedByEmail?: string;
  }): Promise<{ inviteUrl: string; expiresAt: Date; email: string; emailSent: boolean }> {
    const email = input.email.trim().toLowerCase();
    if (!email.includes('@')) {
      throw new Error('Invalid email address');
    }

    if (input.adminStaffRole === AdminStaffRole.super_admin) {
      throw new Error('Cannot invite Super Admin via this flow. Use bootstrap for the first super admin.');
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && (existing.role === UserRole.admin || existing.role === UserRole.superadmin)) {
      throw new Error('This email is already a team member');
    }

    const token = generateInviteToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

    await prisma.adminInvite.deleteMany({
      where: { email, acceptedAt: null },
    });

    await prisma.adminInvite.create({
      data: {
        email,
        adminStaffRole: input.adminStaffRole,
        tokenHash,
        invitedById: input.invitedById,
        expiresAt,
      },
    });

    const base = getAdminFrontendBaseUrl();
    const inviteUrl = `${base}/accept-invite?token=${encodeURIComponent(token)}`;

    try {
      await EmailService.sendAdminTeamInviteEmail(email, {
        inviteUrl,
        roleLabel: STAFF_ROLE_LABELS[input.adminStaffRole],
        expiresAt,
        invitedByEmail: input.invitedByEmail,
      });
    } catch (err: unknown) {
      await prisma.adminInvite.deleteMany({ where: { tokenHash } });
      const detail = err instanceof Error ? err.message : 'unknown error';
      throw new Error(`Failed to send invite email: ${detail}`);
    }

    logger.info('Admin invite created and emailed', {
      email,
      adminStaffRole: input.adminStaffRole,
      inviteBaseUrl: base,
    });

    return { inviteUrl, expiresAt, email, emailSent: true };
  }

  static async acceptInvite(input: {
    token: string;
    password: string;
    username?: string;
  }): Promise<{ userId: string; email: string }> {
    const tokenHash = hashToken(input.token.trim());
    const invite = await prisma.adminInvite.findUnique({ where: { tokenHash } });

    if (!invite || invite.acceptedAt) {
      throw new Error('Invalid or already used invite link');
    }
    if (new Date() > invite.expiresAt) {
      throw new Error('Invite link has expired. Ask your admin for a new invite.');
    }

    const existing = await prisma.user.findUnique({ where: { email: invite.email } });
    if (existing) {
      throw new Error('An account with this email already exists');
    }

    let username = (input.username?.trim() || usernameFromEmail(invite.email)).toLowerCase();
    const taken = await UserService.findByUsername(username);
    if (taken) {
      username = `${username}_${Date.now().toString(36).slice(-4)}`;
    }

    if (input.password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const user = await UserService.createUser({
      username,
      email: invite.email,
      password: input.password,
      role: UserRole.admin,
    });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
        adminStaffRole: invite.adminStaffRole,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        isProfileComplete: true,
      },
    });

    await prisma.adminInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });

    return { userId: user.id, email: invite.email };
  }

  static async updateMember(input: {
    memberId: string;
    adminStaffRole?: AdminStaffRole;
    isTeamDisabled?: boolean;
    actorId: string;
  }): Promise<void> {
    const member = await prisma.user.findUnique({
      where: { id: input.memberId },
      select: { id: true, role: true, email: true },
    });

    if (!member || (member.role !== UserRole.admin && member.role !== UserRole.superadmin)) {
      throw new Error('Team member not found');
    }

    if (member.role === UserRole.superadmin) {
      throw new Error('Cannot modify the super admin account via team settings');
    }

    if (input.memberId === input.actorId && input.isTeamDisabled === true) {
      throw new Error('You cannot disable your own account');
    }

    const data: {
      adminStaffRole?: AdminStaffRole;
      isTeamDisabled?: boolean;
    } = {};

    if (input.adminStaffRole !== undefined) {
      if (input.adminStaffRole === AdminStaffRole.super_admin) {
        throw new Error('Cannot promote to Super Admin via team settings');
      }
      data.adminStaffRole = input.adminStaffRole;
    }
    if (input.isTeamDisabled !== undefined) {
      data.isTeamDisabled = input.isTeamDisabled;
    }

    await prisma.user.update({ where: { id: input.memberId }, data });

    await AdminService.logAction({
      adminId: input.actorId,
      actionType: 'team_member_updated',
      targetType: 'user',
      targetId: input.memberId,
      description: `Updated team member ${member.email}`,
      metadata: data,
    });
  }

  static getPermissionsForUserId(userId: string): Promise<string[]> {
    return prisma.user
      .findUnique({
        where: { id: userId },
        select: { role: true, adminStaffRole: true },
      })
      .then((u) => (u ? permissionsForUser(u) : []));
  }
}

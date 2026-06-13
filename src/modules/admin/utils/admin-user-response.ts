import { User, UserRole } from '@prisma/client';
import { IUserResponse } from '../../auth/types/user.interface';
import {
  permissionsForUser,
  resolveAdminStaffRole,
} from '../permissions';

export function buildStaffAuthFields(user: User): Pick<
  IUserResponse,
  'mustChangePassword' | 'adminStaffRole' | 'permissions'
> {
  if (user.role !== UserRole.admin && user.role !== UserRole.superadmin) {
    return {};
  }

  const staffRole = resolveAdminStaffRole(user);
  return {
    mustChangePassword: user.mustChangePassword,
    adminStaffRole: staffRole,
    permissions: permissionsForUser(user),
  };
}

export function toUserResponse(user: User): IUserResponse {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    isEmailVerified: user.isEmailVerified,
    emailVerifiedAt: user.emailVerifiedAt,
    isProfileComplete: user.isProfileComplete,
    isSuspended: user.isSuspended,
    isUnderInvestigation: user.isUnderInvestigation,
    authProvider: user.authProvider,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    ...buildStaffAuthFields(user),
  };
}

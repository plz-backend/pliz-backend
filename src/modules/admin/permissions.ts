import { AdminStaffRole, UserRole } from '@prisma/client';

export const AdminPermission = {
  DASHBOARD_VIEW: 'dashboard:view',
  USERS_VIEW: 'users:view',
  USERS_MODERATE: 'users:moderate',
  BEGS_VIEW: 'begs:view',
  BEGS_MODERATE: 'begs:moderate',
  WITHDRAWALS_VIEW: 'withdrawals:view',
  WITHDRAWALS_PROCESS: 'withdrawals:process',
  KYC_VIEW: 'kyc:view',
  KYC_MODERATE: 'kyc:moderate',
  STORIES_VIEW: 'stories:view',
  STORIES_MODERATE: 'stories:moderate',
  CATEGORIES_MANAGE: 'categories:manage',
  OPS_VIEW: 'ops:view',
  ACTIVITY_VIEW: 'activity:view',
  TEAM_MANAGE: 'team:manage',
} as const;

export type AdminPermissionKey = (typeof AdminPermission)[keyof typeof AdminPermission];

const ALL_PERMISSIONS = Object.values(AdminPermission);

const ROLE_PERMISSIONS: Record<AdminStaffRole, AdminPermissionKey[]> = {
  super_admin: ALL_PERMISSIONS,
  operations: [
    AdminPermission.DASHBOARD_VIEW,
    AdminPermission.USERS_VIEW,
    AdminPermission.USERS_MODERATE,
    AdminPermission.BEGS_VIEW,
    AdminPermission.BEGS_MODERATE,
    AdminPermission.WITHDRAWALS_VIEW,
    AdminPermission.WITHDRAWALS_PROCESS,
    AdminPermission.KYC_VIEW,
    AdminPermission.KYC_MODERATE,
    AdminPermission.STORIES_VIEW,
    AdminPermission.STORIES_MODERATE,
    AdminPermission.OPS_VIEW,
    AdminPermission.ACTIVITY_VIEW,
  ],
  support: [
    AdminPermission.DASHBOARD_VIEW,
    AdminPermission.USERS_VIEW,
    AdminPermission.KYC_VIEW,
    AdminPermission.OPS_VIEW,
    AdminPermission.ACTIVITY_VIEW,
    AdminPermission.BEGS_VIEW,
    AdminPermission.STORIES_VIEW,
  ],
  finance: [
    AdminPermission.DASHBOARD_VIEW,
    AdminPermission.WITHDRAWALS_VIEW,
    AdminPermission.WITHDRAWALS_PROCESS,
    AdminPermission.ACTIVITY_VIEW,
  ],
  viewer: [
    AdminPermission.DASHBOARD_VIEW,
    AdminPermission.USERS_VIEW,
    AdminPermission.BEGS_VIEW,
    AdminPermission.WITHDRAWALS_VIEW,
    AdminPermission.KYC_VIEW,
    AdminPermission.STORIES_VIEW,
    AdminPermission.OPS_VIEW,
    AdminPermission.ACTIVITY_VIEW,
  ],
};

export function resolveAdminStaffRole(user: {
  role: UserRole;
  adminStaffRole?: AdminStaffRole | null;
}): AdminStaffRole | null {
  if (user.role !== UserRole.admin && user.role !== UserRole.superadmin) {
    return null;
  }
  if (user.role === UserRole.superadmin) {
    return AdminStaffRole.super_admin;
  }
  return user.adminStaffRole ?? AdminStaffRole.viewer;
}

export function permissionsForUser(user: {
  role: UserRole;
  adminStaffRole?: AdminStaffRole | null;
}): AdminPermissionKey[] {
  const staffRole = resolveAdminStaffRole(user);
  if (!staffRole) return [];
  return ROLE_PERMISSIONS[staffRole];
}

export function userHasPermission(
  user: { role: UserRole; adminStaffRole?: AdminStaffRole | null },
  permission: AdminPermissionKey
): boolean {
  return permissionsForUser(user).includes(permission);
}

export const STAFF_ROLE_LABELS: Record<AdminStaffRole, string> = {
  super_admin: 'Super Admin',
  operations: 'Operations',
  support: 'Support',
  finance: 'Finance',
  viewer: 'Viewer',
};

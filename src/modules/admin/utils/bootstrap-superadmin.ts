import { AdminStaffRole } from '@prisma/client';
import prisma from '../../../config/database';

/** Post-create fields for the first bootstrapped super admin. */
export async function applyBootstrapSuperAdminFields(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
      isProfileComplete: true,
      adminStaffRole: AdminStaffRole.super_admin,
      mustChangePassword: true,
    },
  });
}

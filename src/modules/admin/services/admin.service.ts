import prisma from '../../../config/database';
import logger from '../../../config/logger';

export class AdminService {
  /**
   * Log admin action
   */
  static async logAction(data: {
    adminId: string;
    actionType: string;
    targetType?: string;
    targetId?: string;
    description: string;
    metadata?: any;
    ipAddress?: string;
  }): Promise<void> {
    try {
      await prisma.adminAction.create({
        data: {
          adminId: data.adminId,
          actionType: data.actionType,
          targetType: data.targetType,
          targetId: data.targetId,
          description: data.description,
          metadata: data.metadata,
          ipAddress: data.ipAddress,
        },
      });
    } catch (error: any) {
      logger.error('Failed to log admin action', { error: error.message });
    }
  }

  /**
   * Suspend user
   */
  static async suspendUser(
    userId: string,
    reason: string,
    adminId: string,
    ipAddress?: string
  ): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        isSuspended: true,
        suspensionReason: reason,
        suspendedAt: new Date(),
        suspendedBy: adminId,
      },
    });

    // Put all pending withdrawals on hold
    await prisma.withdrawal.updateMany({
      where: {
        userId,
        status: 'pending',
      },
      data: {
        status: 'on_hold',
        failureReason: 'User account suspended',
      },
    });

    await this.logAction({
      adminId,
      actionType: 'suspend_user',
      targetType: 'user',
      targetId: userId,
      description: `Suspended user: ${reason}`,
      metadata: { reason },
      ipAddress,
    });

    logger.warn('User suspended', { userId, reason, adminId });
  }

  /**
   * Unsuspend user
   */
  static async unsuspendUser(
    userId: string,
    adminId: string,
    ipAddress?: string
  ): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        isSuspended: false,
        suspensionReason: null,
        suspendedAt: null,
        suspendedBy: null,
      },
    });

    await this.logAction({
      adminId,
      actionType: 'unsuspend_user',
      targetType: 'user',
      targetId: userId,
      description: 'User account unsuspended',
      ipAddress,
    });

    logger.info('User unsuspended', { userId, adminId });
  }

  /**
   * Put user under investigation
   */
  static async investigateUser(
    userId: string,
    reason: string,
    adminId: string,
    ipAddress?: string
  ): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        isUnderInvestigation: true,
        investigationReason: reason,
        investigationStartedAt: new Date(),
      },
    });

    // Put all pending withdrawals on hold
    await prisma.withdrawal.updateMany({
      where: {
        userId,
        status: 'pending',
      },
      data: {
        status: 'on_hold',
        failureReason: 'User under investigation',
      },
    });

    await this.logAction({
      adminId,
      actionType: 'investigate_user',
      targetType: 'user',
      targetId: userId,
      description: `User under investigation: ${reason}`,
      metadata: { reason },
      ipAddress,
    });

    logger.warn('User under investigation', { userId, reason, adminId });
  }

  /**
   * Close investigation
   */
  static async closeInvestigation(
    userId: string,
    adminId: string,
    ipAddress?: string
  ): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: {
        isUnderInvestigation: false,
        investigationReason: null,
        investigationStartedAt: null,
      },
    });

    await this.logAction({
      adminId,
      actionType: 'close_investigation',
      targetType: 'user',
      targetId: userId,
      description: 'Investigation closed',
      ipAddress,
    });

    logger.info('Investigation closed', { userId, adminId });
  }

  /**
   * Get all users (with filters)
   */
  static async getAllUsers(filters: {
    page?: number;
    limit?: number;
    suspended?: boolean;
    underInvestigation?: boolean;
    role?: string;
  }): Promise<any> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.suspended !== undefined) where.isSuspended = filters.suspended;
    if (filters.underInvestigation !== undefined)
      where.isUnderInvestigation = filters.underInvestigation;
    if (filters.role) where.role = filters.role;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          isEmailVerified: true,
          isSuspended: true,
          suspensionReason: true,
          suspendedAt: true,
          isUnderInvestigation: true,
          investigationReason: true,
          investigationStartedAt: true,
          createdAt: true,
          stats: {
            select: {
              requestsCount: true,
              totalReceived: true,
              totalDonated: true,
              abuseFlags: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get dashboard statistics
   */
  static async getDashboardStats(): Promise<any> {
    const [
      totalUsers,
      suspendedUsers,
      investigatedUsers,
      totalBegs,
      activeBegs,
      pendingBegs,
      totalDonations,
      totalWithdrawals,
      pendingWithdrawals,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isSuspended: true } }),
      prisma.user.count({ where: { isUnderInvestigation: true } }),
      prisma.beg.count(),
      prisma.beg.count({ where: { status: 'active' } }),
      prisma.beg.count({ where: { approved: false } }),
      prisma.donation.count({ where: { status: 'success' } }),
      prisma.withdrawal.count(),
      prisma.withdrawal.count({ where: { status: 'pending' } }),
    ]);

    const donationSum = await prisma.donation.aggregate({
      where: { status: 'success' },
      _sum: { amount: true },
    });

    const withdrawalSum = await prisma.withdrawal.aggregate({
      where: { status: 'completed' },
      _sum: { amountToReceive: true, companyFee: true, vatFee: true },
    });

    return {
      users: {
        total: totalUsers,
        suspended: suspendedUsers,
        under_investigation: investigatedUsers,
      },
      begs: {
        total: totalBegs,
        active: activeBegs,
        pending_approval: pendingBegs,
      },
      donations: {
        total_count: totalDonations,
        total_amount: donationSum._sum.amount
          ? parseFloat(donationSum._sum.amount.toString())
          : 0,
      },
      withdrawals: {
        total_count: totalWithdrawals,
        pending_count: pendingWithdrawals,
        total_paid: withdrawalSum._sum.amountToReceive
          ? parseFloat(withdrawalSum._sum.amountToReceive.toString())
          : 0,
        total_company_fees: withdrawalSum._sum.companyFee
          ? parseFloat(withdrawalSum._sum.companyFee.toString())
          : 0,
        total_vat: withdrawalSum._sum.vatFee
          ? parseFloat(withdrawalSum._sum.vatFee.toString())
          : 0,
      },
    };
  }
}
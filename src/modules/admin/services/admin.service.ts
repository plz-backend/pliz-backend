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
    deleted?: boolean;
    role?: string;
    /** customers = app users only (default); team = staff; all = everyone */
    audience?: 'customers' | 'team' | 'all';
  }): Promise<any> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.suspended !== undefined) where.isSuspended = filters.suspended;
    if (filters.underInvestigation !== undefined)
      where.isUnderInvestigation = filters.underInvestigation;
    if (filters.deleted !== undefined) where.isDeleted = filters.deleted;

    const audience = filters.audience ?? 'customers';
    if (filters.role) {
      where.role = filters.role;
    } else if (audience === 'customers') {
      where.role = 'user';
    } else if (audience === 'team') {
      where.role = { in: ['admin', 'superadmin'] };
    }

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
          isDeleted: true,
          deletedAt: true,
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

  /**
   * Time-series analytics for dashboard charts
   */
  static async getDashboardAnalytics(days = 30): Promise<{
    rangeDays: number;
    signupsByDay: { date: string; count: number }[];
    donationsByDay: { date: string; count: number; amount: number }[];
    withdrawalsByDay: { date: string; count: number; amount: number }[];
    kycByDay: { date: string; verified: number; rejected: number }[];
    opsErrorsLast24h: number;
    pending: {
      withdrawals: number;
      begs: number;
      kycUnderReview: number;
    };
  }> {
    const rangeDays = Math.min(Math.max(days, 7), 90);
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - rangeDays);
    since.setUTCHours(0, 0, 0, 0);

    const dayKey = (d: Date) => d.toISOString().slice(0, 10);

    const fillDays = (): string[] => {
      const keys: string[] = [];
      for (let i = rangeDays - 1; i >= 0; i--) {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - i);
        keys.push(dayKey(d));
      }
      return keys;
    };

    const dayKeys = fillDays();

    const [users, donations, withdrawals, kycVerified, kycRejected, opsErrors, pendingWd, pendingBegs, kycReview] =
      await Promise.all([
        prisma.user.findMany({
          where: { createdAt: { gte: since }, role: 'user' },
          select: { createdAt: true },
        }),
        prisma.donation.findMany({
          where: { createdAt: { gte: since }, status: 'success' },
          select: { createdAt: true, amount: true },
        }),
        prisma.withdrawal.findMany({
          where: { createdAt: { gte: since }, status: 'completed' },
          select: { createdAt: true, amountToReceive: true },
        }),
        prisma.userVerification.findMany({
          where: { verifiedAt: { gte: since } },
          select: { verifiedAt: true },
        }),
        prisma.userVerification.findMany({
          where: { rejectedAt: { gte: since } },
          select: { rejectedAt: true },
        }),
        prisma.operationalEvent.count({
          where: {
            severity: 'error',
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }),
        prisma.withdrawal.count({ where: { status: 'pending' } }),
        prisma.beg.count({ where: { approved: false } }),
        prisma.userVerification.count({ where: { status: 'under_review' } }),
      ]);

    const signupMap = new Map(dayKeys.map((k) => [k, 0]));
    users.forEach((u) => {
      const k = dayKey(u.createdAt);
      if (signupMap.has(k)) signupMap.set(k, (signupMap.get(k) ?? 0) + 1);
    });

    const donationMap = new Map(dayKeys.map((k) => [k, { count: 0, amount: 0 }]));
    donations.forEach((d) => {
      const k = dayKey(d.createdAt);
      const cur = donationMap.get(k);
      if (cur) {
        cur.count += 1;
        cur.amount += parseFloat(d.amount.toString());
      }
    });

    const withdrawalMap = new Map(dayKeys.map((k) => [k, { count: 0, amount: 0 }]));
    withdrawals.forEach((w) => {
      const k = dayKey(w.createdAt);
      const cur = withdrawalMap.get(k);
      if (cur) {
        cur.count += 1;
        cur.amount += parseFloat(w.amountToReceive.toString());
      }
    });

    const kycMap = new Map(dayKeys.map((k) => [k, { verified: 0, rejected: 0 }]));
    kycVerified.forEach((v) => {
      if (!v.verifiedAt) return;
      const k = dayKey(v.verifiedAt);
      const cur = kycMap.get(k);
      if (cur) cur.verified += 1;
    });
    kycRejected.forEach((v) => {
      if (!v.rejectedAt) return;
      const k = dayKey(v.rejectedAt);
      const cur = kycMap.get(k);
      if (cur) cur.rejected += 1;
    });

    return {
      rangeDays,
      signupsByDay: dayKeys.map((date) => ({ date, count: signupMap.get(date) ?? 0 })),
      donationsByDay: dayKeys.map((date) => {
        const v = donationMap.get(date)!;
        return { date, count: v.count, amount: Math.round(v.amount) };
      }),
      withdrawalsByDay: dayKeys.map((date) => {
        const v = withdrawalMap.get(date)!;
        return { date, count: v.count, amount: Math.round(v.amount) };
      }),
      kycByDay: dayKeys.map((date) => {
        const v = kycMap.get(date)!;
        return { date, verified: v.verified, rejected: v.rejected };
      }),
      opsErrorsLast24h: opsErrors,
      pending: {
        withdrawals: pendingWd,
        begs: pendingBegs,
        kycUnderReview: kycReview,
      },
    };
  }
}
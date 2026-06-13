import prisma from '../../../config/database';
import logger from '../../../config/logger';
import { CacheService } from './cacheService';
import { SessionService } from './session.service';

export class AccountDeletionError extends Error {
  readonly statusCode: number;
  readonly code?: string;

  constructor(message: string, statusCode = 400, code?: string) {
    super(message);
    this.name = 'AccountDeletionError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

const BLOCKED_WITHDRAWAL_STATUSES = ['pending', 'processing'];

export class AccountDeletionService {
  /**
   * Validates the account can be self-deleted. Throws AccountDeletionError when not allowed.
   */
  static async assertCanDelete(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        isDeleted: true,
        isUnderInvestigation: true,
      },
    });

    if (!user) {
      throw new AccountDeletionError('User not found', 404);
    }

    if (user.isDeleted) {
      throw new AccountDeletionError('Account is already deleted', 400, 'ACCOUNT_DELETED');
    }

    if (user.isUnderInvestigation) {
      throw new AccountDeletionError(
        'Your account is under investigation and cannot be deleted right now. Contact support@plz.ng for help.',
        403,
        'ACCOUNT_UNDER_INVESTIGATION'
      );
    }

    const [pendingWithdrawal, begWithDonations] = await Promise.all([
      prisma.withdrawal.findFirst({
        where: {
          userId,
          status: { in: BLOCKED_WITHDRAWAL_STATUSES },
        },
        select: { id: true },
      }),
      prisma.beg.findFirst({
        where: {
          userId,
          status: 'active',
          amountRaised: { gt: 0 },
        },
        select: { id: true },
      }),
    ]);

    if (pendingWithdrawal) {
      throw new AccountDeletionError(
        'You have a withdrawal in progress. Please wait until it completes or contact support before deleting your account.',
        409,
        'PENDING_WITHDRAWAL'
      );
    }

    if (begWithDonations) {
      throw new AccountDeletionError(
        'You have an active help request that received donations. Contact support@plz.ng to delete your account safely.',
        409,
        'ACTIVE_BEG_WITH_DONATIONS'
      );
    }
  }

  /**
   * Soft-delete account, hide user content, and revoke sessions/cache.
   */
  static async softDeleteAccount(params: {
    userId: string;
    deletedBy: string;
    reason?: string;
    accessToken?: string;
  }): Promise<void> {
    const { userId, deletedBy, reason, accessToken } = params;

    await this.assertCanDelete(userId);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedBy,
          deleteReason: reason?.trim() || 'User requested account deletion',
          isProfileComplete: false,
        },
      }),
      prisma.beg.updateMany({
        where: {
          userId,
          status: 'active',
          amountRaised: 0,
        },
        data: { status: 'cancelled' },
      }),
      prisma.story.updateMany({
        where: { userId },
        data: { isVisible: false },
      }),
    ]);

    await SessionService.deactivateAllUserSessions(userId);
    await CacheService.deleteUserSession(userId);
    await CacheService.invalidateMeCache(userId);

    if (accessToken) {
      await CacheService.blacklistToken(accessToken, 15 * 60);
    }

    logger.info('Account soft deleted', {
      userId,
      deletedBy,
      reason: reason?.trim() || 'User requested account deletion',
    });
  }
}

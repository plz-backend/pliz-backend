import prisma from '../../../config/database';
import {
  IBeg,
  IBegResponse,
  ICreateBegRequest,
  IUpdateBegRequest,
  IBegWithRelations,
  BegStatus,
  ExpiryHours,
  ITierProgressionResult,
} from '../types/beg.interface';
import { TrustScoreService } from '../../../services/trust_score.service';
import { CooldownService } from '../../../services/cooldown.service';
import { CategoryService } from './category.service';
import { ProfilePictureService } from '../../ProfilePicture/services/profile-picture.service';
import logger from '../../../config/logger';
import redisClient from '../../../config/redis';

const BEGS_FEED_CACHE_PREFIX = 'begs_feed:';
const BEGS_FEED_CACHE_TTL = 60; // seconds

const MAX_DESCRIPTION_WORDS = 40;
const MAX_DESCRIPTION_LENGTH = 300;
const VALID_EXPIRY_HOURS = [24, 72, 168] as const;

const BEG_USER_SELECT = {
  username: true,
  profileAvatar: {
    select: {
      avatarType: true,
      avatarUrl: true,
      avatarColor: true,
      avatarLibraryId: true,
    },
  },
  profile: {
    select: {
      displayName: true,
      firstName: true,
      lastName: true,
      isAnonymous: true,
    },
  },
} as const;

/** Pending begs must not count down or hit the expiry cron; real `expiresAt` is set on admin approval. */
const BEG_EXPIRY_PENDING_PLACEHOLDER = new Date('2099-12-31T23:59:59.999Z');

export class BegService {

  // ============================================
  // VALIDATE DESCRIPTION
  // ============================================
  private static validateDescription(description: string): void {
    const trimmed = description.trim();
    if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
      throw new Error(
        `Description is too long (max ${MAX_DESCRIPTION_LENGTH} characters)`
      );
    }
    const wordCount = trimmed
      .split(/\s+/)
      .filter(word => word.length > 0).length;
    if (wordCount > MAX_DESCRIPTION_WORDS) {
      throw new Error(
        `Description must be ${MAX_DESCRIPTION_WORDS} words or less (currently ${wordCount} words)`
      );
    }
  }

  // ============================================
  // TIER PROGRESSION CHECK
  //
  // Rule 1: > ₦10k  → must be verified + donated once
  // Rule 2: > ₦50k  → must have donated ₦10k total
  // Rule 3: > ₦100k → must have donated ₦50k total
  // Rule 4: > ₦200k → hard block (MVP cap)
  // ============================================
  private static async checkTierProgression(
    userId: string,
    requestedAmount: number
  ): Promise<ITierProgressionResult> {

    // ── HARD LIMIT — MVP CAP ──────────────────
    if (requestedAmount > 200000) {
      return {
        allowed: false,
        errorMessage: 'The maximum request amount is ₦200,000 during our current phase.',
        uiMessage: {
          title: '⚠️ Maximum Amount Reached',
          body: 'The maximum amount you can request is ₦200,000.\n\nThis limit applies to all users during our current phase.',
          action: 'Adjust Amount',
        },
      };
    }

    // Tier 1 — no extra checks needed for ≤ ₦10k
    if (requestedAmount <= 10000) {
      return { allowed: true };
    }

    // Fetch verification + stats only when needed
    const [verification, stats] = await Promise.all([
      prisma.userVerification.findUnique({
        where: { userId },
        select: { isVerified: true },
      }),
      prisma.userStats.findUnique({
        where: { userId },
        select: { totalDonated: true },
      }),
    ]);

    const isVerified = verification?.isVerified || false;
    const totalDonated = stats?.totalDonated
      ? Number(stats.totalDonated)
      : 0;
    const hasDonated = totalDonated > 0;

    // ── RULE 1: > ₦10k ────────────────────────
    // Need: verified + at least 1 donation
    if (requestedAmount > 10000) {
      if (!isVerified && !hasDonated) {
        return {
          allowed: false,
          errorMessage: 'To request more than ₦10,000 you need to verify your identity and make at least 1 donation.',
          uiMessage: {
            title: '🔒 Two Steps to Unlock',
            body: 'To request more than ₦10,000 you need to:\n\n1️⃣ Complete your KYC verification\n2️⃣ Make at least 1 donation of any amount\n\nThese steps help build trust in the Plz community.',
            action: 'Start Verification',
          },
        };
      }

      if (!isVerified) {
        return {
          allowed: false,
          errorMessage: 'To request more than ₦10,000 you must complete your identity verification.',
          uiMessage: {
            title: '🔒 Verification Required',
            body: 'To request more than ₦10,000 you need to verify your identity.\n\nGo to Profile → Verify Identity. It takes less than 3 minutes.',
            action: 'Verify Identity',
          },
        };
      }

      if (!hasDonated) {
        return {
          allowed: false,
          errorMessage: 'To request more than ₦10,000 you must make at least 1 donation first.',
          uiMessage: {
            title: '💝 Donate First',
            body: 'To request more than ₦10,000 you need to make at least 1 donation of any amount.\n\nHelping others first shows you are part of the Plz community.',
            action: 'Browse Requests',
          },
        };
      }
    }

    // ── RULE 2: > ₦50k ────────────────────────
    // Need: total donated ≥ ₦10,000
    if (requestedAmount > 50000) {
      if (totalDonated < 10000) {
        const donated = totalDonated.toLocaleString();
        const remaining = (10000 - totalDonated).toLocaleString();
        return {
          allowed: false,
          errorMessage: `To request more than ₦50,000 you must have donated at least ₦10,000 in total. You have donated ₦${donated} so far.`,
          uiMessage: {
            title: '⭐ Trusted User Required',
            body: `To request more than ₦50,000 you need to have donated at least ₦10,000 in total.\n\nYou have donated ₦${donated} so far.\n\nDonate ₦${remaining} more to unlock ⭐ Trusted User tier!`,
            action: 'Donate Now',
          },
        };
      }
    }

    // ── RULE 3: > ₦100k ───────────────────────
    // Need: total donated ≥ ₦50,000
    if (requestedAmount > 100000) {
      if (totalDonated < 50000) {
        const donated = totalDonated.toLocaleString();
        const remaining = (50000 - totalDonated).toLocaleString();
        return {
          allowed: false,
          errorMessage: `To request more than ₦100,000 you must have donated at least ₦50,000 in total. You have donated ₦${donated} so far.`,
          uiMessage: {
            title: '👑 Super User Required',
            body: `To request more than ₦100,000 you need to have donated at least ₦50,000 in total.\n\nYou have donated ₦${donated} so far.\n\nDonate ₦${remaining} more to unlock 👑 Super User tier!`,
            action: 'Donate Now',
          },
        };
      }
    }

    return { allowed: true };
  }

  // ============================================
  // CREATE BEG
  // ============================================
  static async createBeg(
    userId: string,
    data: ICreateBegRequest
  ): Promise<IBeg> {
    try {
      // Validate description
      if (data.description) {
        this.validateDescription(data.description);
      }

      // Validate expiryHours
      const expiryHours = VALID_EXPIRY_HOURS.includes(data.expiryHours as any)
        ? data.expiryHours!
        : 24;

      // Validate category
      const isValidCategory = await CategoryService.validateCategory(
        data.categoryId
      );
      if (!isValidCategory) {
        throw new Error('Invalid or inactive category');
      }

      const userProfile = await prisma.userProfile.findUnique({
        where: { userId },
        select: { isAnonymous: true },
      });
      const isAnonymous = Boolean(userProfile?.isAnonymous || data.isAnonymous);

      // ── TIER PROGRESSION CHECK ────────────────
      const tierCheck = await this.checkTierProgression(
        userId,
        data.amountRequested
      );

      if (!tierCheck.allowed) {
        const err: any = new Error(tierCheck.errorMessage);
        err.uiMessage = tierCheck.uiMessage;
        err.statusCode = 403;
        throw err;
      }
      // ─────────────────────────────────────────

      // Get trust info for cooldown + daily limits
      const trustInfo = await TrustScoreService.getUserTrustInfo(userId);

      // ── CHECK COOLDOWN ────────────────────────
      const cooldownInfo = await CooldownService.checkCooldown(userId);
      if (cooldownInfo.isOnCooldown) {
        const hoursRemaining = cooldownInfo.hoursRemaining || 0;
        const daysRemaining = Math.ceil(hoursRemaining / 24);
        const timeMessage =
          hoursRemaining >= 24
            ? `${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`
            : `${hoursRemaining} hour${hoursRemaining > 1 ? 's' : ''}`;

        const err: any = new Error(
          cooldownInfo.message || 'You are on cooldown'
        );
        err.uiMessage = {
          title: '⏳ Cooldown Active',
          body: `You need to wait ${timeMessage} before creating a new request.\n\nCooldown periods help keep the community fair for everyone.\n\n${trustInfo.badge} ${trustInfo.tierName} cooldown: ${trustInfo.cooldownDays} day${trustInfo.cooldownDays > 1 ? 's' : ''}`,
          action: 'OK',
        };
        err.statusCode = 429;
        throw err;
      }
      // ─────────────────────────────────────────

      // ── CHECK DAILY LIMIT ─────────────────────
      const requestCountInfo = await CooldownService.checkDailyRequestCount(
        userId,
        trustInfo.tier
      );
      if (!requestCountInfo.canRequest) {
        const err: any = new Error(
          `You have reached your daily limit of ${requestCountInfo.limit} request${requestCountInfo.limit > 1 ? 's' : ''}`
        );
        err.uiMessage = {
          title: '📊 Daily Limit Reached',
          body: `You have used all ${requestCountInfo.limit} of your daily request${requestCountInfo.limit > 1 ? 's' : ''}.\n\nYour limit resets at midnight. Come back tomorrow to create more requests.`,
          action: 'OK',
        };
        err.statusCode = 429;
        throw err;
      }
      // ─────────────────────────────────────────

      // Create beg
      const beg = await prisma.beg.create({
        data: {
          userId,
          categoryId: data.categoryId,
          description: data.description?.trim() || null,
          amountRequested: data.amountRequested,
          amountRaised: 0,
          status: 'active',
          expiryHours,
          expiresAt: BEG_EXPIRY_PENDING_PLACEHOLDER,
          payoutRequested: false,
          isAnonymous,
          approved: false,
          mediaType: data.mediaType || 'text',
          mediaUrl: data.mediaUrl || null,
        },
      });

      logger.info('Beg created successfully', {
        begId: beg.id,
        userId,
        amount: data.amountRequested,
      });

      return {
        id: beg.id,
        userId: beg.userId,
        categoryId: beg.categoryId,
        description: beg.description,
        expiryHours: beg.expiryHours as ExpiryHours,
        amountRequested: Number(beg.amountRequested),
        amountRaised: Number(beg.amountRaised),
        status: beg.status as BegStatus,
        approved: beg.approved,
        approvedAt: beg.approvedAt,
        approvedBy: beg.approvedBy,
        rejectedAt: beg.rejectedAt,
        rejectedBy: beg.rejectedBy,
        rejectionReason: beg.rejectionReason,
        expiresAt: beg.expiresAt,
        payoutRequested: beg.payoutRequested,
        isAnonymous: beg.isAnonymous,
        isWithdrawn: beg.isWithdrawn,
        withdrawnAt: beg.withdrawnAt,
        mediaType: beg.mediaType,
        mediaUrl: beg.mediaUrl,
        createdAt: beg.createdAt,
        updatedAt: beg.updatedAt,
      };
    } catch (error: any) {
      logger.error('Failed to create beg', { error: error.message, userId });
      throw error;
    }
  }

  // ============================================
  // EXTEND BEG
  // ============================================
  static async extendBeg(
    begId: string,
    userId: string,
    expiryHours: 24 | 72 | 168
  ): Promise<IBeg> {
    try {
      const beg = await prisma.beg.findUnique({ where: { id: begId } });
      if (!beg) throw new Error('Beg not found');
      if (beg.userId !== userId) throw new Error('Unauthorized to extend this beg');
      if (beg.status !== 'active') throw new Error('Can only extend active begs');
      if (!beg.approved) throw new Error('Can only extend approved requests');
      if (!VALID_EXPIRY_HOURS.includes(expiryHours as any)) {
        throw new Error('Invalid expiry hours. Must be 24, 72, or 168');
      }
      if (expiryHours <= beg.expiryHours) {
        throw new Error(
          `New expiry must be greater than current expiry of ${beg.expiryHours} hours`
        );
      }

      const newExpiresAt = new Date();
      newExpiresAt.setHours(newExpiresAt.getHours() + expiryHours);

      const updated = await prisma.beg.update({
        where: { id: begId },
        data: { expiryHours, expiresAt: newExpiresAt },
      });

      logger.info('Beg extended', {
        begId,
        userId,
        from: beg.expiryHours,
        to: expiryHours,
      });

      return {
        id: updated.id,
        userId: updated.userId,
        categoryId: updated.categoryId,
        description: updated.description,
        expiryHours: updated.expiryHours as ExpiryHours,
        amountRequested: Number(updated.amountRequested),
        amountRaised: Number(updated.amountRaised),
        status: updated.status as BegStatus,
        approved: updated.approved,
        approvedAt: updated.approvedAt,
        approvedBy: updated.approvedBy,
        rejectedAt: updated.rejectedAt,
        rejectedBy: updated.rejectedBy,
        rejectionReason: updated.rejectionReason,
        expiresAt: updated.expiresAt,
        payoutRequested: updated.payoutRequested,
        isAnonymous: updated.isAnonymous,
        isWithdrawn: updated.isWithdrawn,
        withdrawnAt: updated.withdrawnAt,
        mediaType: updated.mediaType,
        mediaUrl: updated.mediaUrl,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    } catch (error: any) {
      logger.error('Failed to extend beg', {
        error: error.message,
        begId,
        userId,
      });
      throw error;
    }
  }

  // ============================================
  // UPDATE BEG
  // ============================================
  static async updateBeg(
    begId: string,
    data: IUpdateBegRequest
  ): Promise<IBegResponse> {
    try {
      if (data.description !== undefined && data.description !== null) {
        this.validateDescription(data.description);
      }

      const updateData: any = {};
      if (data.description !== undefined) {
        updateData.description = data.description
          ? data.description.trim()
          : null;
      }
      if (data.amountRequested !== undefined) {
        updateData.amountRequested = data.amountRequested;
      }
      if (data.mediaType !== undefined) {
        updateData.mediaType = data.mediaType;
      }
      if (data.mediaUrl !== undefined) {
        updateData.mediaUrl = data.mediaUrl;
      }

      const updatedBeg = await prisma.beg.update({
        where: { id: begId },
        data: updateData,
        include: {
          category: true,
          user: {
            select: BEG_USER_SELECT,
          },
        },
      });

      logger.info('Beg updated successfully', {
        begId,
        updatedFields: Object.keys(updateData),
      });

      return await this.transformBegResponse(updatedBeg as IBegWithRelations);
    } catch (error: any) {
      logger.error('Failed to update beg', { error: error.message, begId });
      throw error;
    }
  }

  // ============================================
  // GET ACTIVE BEGS (FEED)
  // ============================================
  static async getActiveBegs(
    page: number = 1,
    limit: number = 20,
    categoryId?: string
  ): Promise<{ begs: IBegResponse[]; total: number; pages: number }> {
    try {
      const cacheKey = `${BEGS_FEED_CACHE_PREFIX}${page}:${limit}:${categoryId ?? 'all'}`;
      try {
        const cached = await redisClient.getClient().get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      } catch (cacheError: any) {
        logger.warn('Beg feed cache read failed', { error: cacheError.message });
      }

      const skip = (page - 1) * limit;
      const where: any = {
        status: 'active',
        approved: true,
        expiresAt: { gt: new Date() },
        user: { isDeleted: false },
      };
      if (categoryId) where.categoryId = categoryId;

      const [begs, total] = await Promise.all([
        prisma.beg.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            category: true,
            user: {
              select: BEG_USER_SELECT,
            },
          },
        }),
        prisma.beg.count({ where }),
      ]);

      const result = {
        begs: await Promise.all(
          begs.map((beg: IBegWithRelations) => this.transformBegResponse(beg))
        ),
        total,
        pages: Math.ceil(total / limit),
      };

      try {
        await redisClient
          .getClient()
          .setEx(cacheKey, BEGS_FEED_CACHE_TTL, JSON.stringify(result));
      } catch (cacheError: any) {
        logger.warn('Beg feed cache write failed', { error: cacheError.message });
      }

      return result;
    } catch (error: any) {
      logger.error('Failed to get active begs', { error: error.message });
      throw error;
    }
  }

  // ============================================
  // GET BEG BY ID
  // ============================================
  static async getBegById(begId: string): Promise<IBegResponse | null> {
    try {
      const beg = await prisma.beg.findUnique({
        where: { id: begId },
        include: {
          category: true,
          user: {
            select: BEG_USER_SELECT,
          },
        },
      });

      if (!beg) return null;
      return await this.transformBegResponse(beg as IBegWithRelations);
    } catch (error: any) {
      logger.error('Failed to get beg by ID', { error: error.message, begId });
      return null;
    }
  }

  // ============================================
  // GET USER BEGS
  // ============================================
  static async getUserBegs(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ begs: IBegResponse[]; total: number; pages: number }> {
    try {
      const skip = (page - 1) * limit;
      const [begs, total] = await Promise.all([
        prisma.beg.findMany({
          where: { userId },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            category: true,
            user: {
              select: BEG_USER_SELECT,
            },
          },
        }),
        prisma.beg.count({ where: { userId } }),
      ]);

      return {
        begs: await Promise.all(
          begs.map((beg: IBegWithRelations) => this.transformBegResponse(beg))
        ),
        total,
        pages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      logger.error('Failed to get user begs', { error: error.message, userId });
      throw error;
    }
  }

  // ============================================
  // UPDATE BEG STATUS
  // ============================================
  static async updateBegStatus(
    begId: string,
    status: BegStatus
  ): Promise<IBeg> {
    try {
      const beg = await prisma.beg.update({
        where: { id: begId },
        data: { status },
      });

      logger.info('Beg status updated', { begId, status });

      return {
        id: beg.id,
        userId: beg.userId,
        categoryId: beg.categoryId,
        description: beg.description,
        expiryHours: beg.expiryHours as ExpiryHours,
        amountRequested: Number(beg.amountRequested),
        amountRaised: Number(beg.amountRaised),
        status: beg.status as BegStatus,
        approved: beg.approved,
        approvedAt: beg.approvedAt,
        approvedBy: beg.approvedBy,
        rejectedAt: beg.rejectedAt,
        rejectedBy: beg.rejectedBy,
        rejectionReason: beg.rejectionReason,
        expiresAt: beg.expiresAt,
        payoutRequested: beg.payoutRequested,
        isAnonymous: beg.isAnonymous,
        isWithdrawn: beg.isWithdrawn,
        withdrawnAt: beg.withdrawnAt,
        mediaType: beg.mediaType,
        mediaUrl: beg.mediaUrl,
        createdAt: beg.createdAt,
        updatedAt: beg.updatedAt,
      };
    } catch (error: any) {
      logger.error('Failed to update beg status', {
        error: error.message,
        begId,
      });
      throw error;
    }
  }

  // ============================================
  // CANCEL BEG
  // ============================================
  static async cancelBeg(userId: string, begId: string): Promise<void> {
    try {
      const beg = await prisma.beg.findUnique({ where: { id: begId } });
      if (!beg) throw new Error('Beg not found');
      if (beg.userId !== userId) throw new Error('Unauthorized to cancel this beg');
      if (beg.status !== 'active') throw new Error('Can only cancel active begs');
      if (Number(beg.amountRaised) > 0) {
        throw new Error('Cannot cancel a beg that has received donations');
      }

      await prisma.beg.update({
        where: { id: begId },
        data: { status: 'cancelled' },
      });

      logger.info('Beg cancelled by user', { begId, userId });
    } catch (error: any) {
      logger.error('Failed to cancel beg', {
        error: error.message,
        begId,
        userId,
      });
      throw error;
    }
  }

  // ============================================
  // EXPIRE OLD BEGS (CRON JOB)
  // ============================================
  static async expireOldBegs(): Promise<number> {
    try {
      const result = await prisma.beg.updateMany({
        where: {
          status: 'active',
          expiresAt: { lt: new Date() },
        },
        data: { status: 'expired' },
      });
      logger.info('Old begs expired', { count: result.count });
      return result.count;
    } catch (error: any) {
      logger.error('Failed to expire old begs', { error: error.message });
      return 0;
    }
  }

  // ============================================
  // NOTIFY EXPIRING BEGS (CRON JOB)
  // ============================================
  static async notifyExpiringBegs(): Promise<void> {
    try {
      const soon = new Date();
      soon.setHours(soon.getHours() + 1);

      const expiringBegs = await prisma.beg.findMany({
        where: {
          status: 'active',
          approved: true,
          expiryHours: { in: [24, 72] },
          expiresAt: { lte: soon, gt: new Date() },
        },
        select: {
          id: true,
          userId: true,
          expiryHours: true,
          expiresAt: true,
        },
      });

      for (const beg of expiringBegs) {
        logger.info('Expiry extension prompt triggered', {
          begId: beg.id,
          userId: beg.userId,
          currentExpiryHours: beg.expiryHours,
          canExtendTo: VALID_EXPIRY_HOURS.filter(h => h > beg.expiryHours),
          expiresAt: beg.expiresAt,
        });
      }
    } catch (error: any) {
      logger.error('Failed to notify expiring begs', { error: error.message });
    }
  }

  // ============================================
  // TRANSFORM BEG RESPONSE
  // ============================================
  private static async transformBegResponse(
    beg: IBegWithRelations
  ): Promise<IBegResponse> {
    const now = new Date();
    const timeRemaining = !beg.approved
      ? 'Pending approval'
      : this.calculateTimeRemaining(beg.expiresAt, now);
    const percentFunded =
      Number(beg.amountRequested) > 0
        ? Math.round(
            (Number(beg.amountRaised) / Number(beg.amountRequested)) * 100
          )
        : 0;

    const isAnonymous = beg.isAnonymous || beg.user?.profile?.isAnonymous || false;
    const firstNameRaw = beg.user?.profile?.firstName?.trim();
    const lastNameRaw = beg.user?.profile?.lastName?.trim();

    const ownerAvatarUrl = isAnonymous
      ? undefined
      : await ProfilePictureService.buildListingDisplayUrl({
          avatarType: beg.user?.profileAvatar?.avatarType,
          avatarUrl: beg.user?.profileAvatar?.avatarUrl,
          avatarColor: beg.user?.profileAvatar?.avatarColor,
          firstName: firstNameRaw,
          lastName: lastNameRaw,
        });

    return {
      id: beg.id,
      userId: beg.userId,
      username: isAnonymous
        ? 'Anonymous'
        : beg.user?.profile?.displayName || beg.user.username,
      displayName: beg.user?.profile?.displayName || undefined,
      isAnonymous,
      firstName: isAnonymous ? undefined : firstNameRaw || undefined,
      lastName: isAnonymous ? undefined : lastNameRaw || undefined,
      ownerAvatarUrl,
      description: beg.description,
      expiryHours: beg.expiryHours as ExpiryHours,
      category: {
        id: beg.category.id,
        name: beg.category.name,
        slug: beg.category.slug,
        icon: beg.category.icon,
      },
      amountRequested: Number(beg.amountRequested),
      amountRaised: Number(beg.amountRaised),
      percentFunded,
      status: beg.status as BegStatus,
      approved: beg.approved,
      approvedAt: beg.approvedAt,
      rejectedAt: beg.rejectedAt,
      rejectionReason: beg.rejectionReason,
      expiresAt: beg.expiresAt,
      createdAt: beg.createdAt,
      timeRemaining,
    };
  }

  // ============================================
  // CALCULATE TIME REMAINING
  // ============================================
  private static calculateTimeRemaining(expiresAt: Date, now: Date): string {
    const diff = expiresAt.getTime() - now.getTime();
    if (diff <= 0) return 'Expired';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h`;
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${minutes}m`;
  }
}

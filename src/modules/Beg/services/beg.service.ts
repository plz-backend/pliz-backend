import prisma from '../../../config/database';
import { IBeg, IBegResponse, ICreateBegRequest, IUpdateBegRequest, IBegWithRelations, BegStatus, ExpiryHours } from '../types/beg.interface';
import { TrustScoreService } from '../../../services/trust_score.service';
import { CooldownService } from '../../../services/cooldown.service';
import { CategoryService } from './category.service';
import logger from '../../../config/logger';

// Validation constants
const MAX_DESCRIPTION_WORDS = 40;
const MAX_DESCRIPTION_LENGTH = 300;
const VALID_EXPIRY_HOURS = [24, 72, 168] as const; // 24h, 72h, 7 days

export class BegService {

  /**
   * Validate description
   */
  private static validateDescription(description: string): void {
    const trimmed = description.trim();

    if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
      throw new Error(`Description is too long (max ${MAX_DESCRIPTION_LENGTH} characters)`);
    }

    const wordCount = trimmed.split(/\s+/).filter(word => word.length > 0).length;
    if (wordCount > MAX_DESCRIPTION_WORDS) {
      throw new Error(`Description must be ${MAX_DESCRIPTION_WORDS} words or less (currently ${wordCount} words)`);
    }
  }

  /**
   * Create a new beg
   */
  static async createBeg(userId: string, data: ICreateBegRequest): Promise<IBeg> {
    try {
      // Validate description (optional)
      if (data.description) {
        this.validateDescription(data.description);
      }

      // Validate expiryHours
      const expiryHours = VALID_EXPIRY_HOURS.includes(data.expiryHours as any)
        ? data.expiryHours!
        : 24;

      // Validate category exists and is active
      const isValidCategory = await CategoryService.validateCategory(data.categoryId);
      if (!isValidCategory) {
        throw new Error('Invalid or inactive category');
      }

      // Get user's trust info (cached in Redis)
      const trustInfo = await TrustScoreService.getUserTrustInfo(userId);

      // Check if amount exceeds tier limit
      if (data.amountRequested > trustInfo.maxAmount) {
        throw new Error(`Amount exceeds your tier limit of ₦${trustInfo.maxAmount.toLocaleString()}`);
      }

      // Check cooldown (Redis)
      const cooldownInfo = await CooldownService.checkCooldown(userId);
      if (cooldownInfo.isOnCooldown) {
        throw new Error(cooldownInfo.message || 'You are on cooldown');
      }

      // Check daily request limit (Redis)
      const requestCountInfo = await CooldownService.checkDailyRequestCount(userId, trustInfo.tier);
      if (!requestCountInfo.canRequest) {
        throw new Error(`You have reached your daily limit of ${requestCountInfo.limit} requests`);
      }

      // Calculate expiry date based on user's choice
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + expiryHours);

      // Create the beg
      const beg = await prisma.beg.create({
        data: {
          userId,
          categoryId: data.categoryId,
          description: data.description?.trim() || null,
          amountRequested: data.amountRequested,
          amountRaised: 0,
          status: 'active',
          expiryHours,
          expiresAt,
          payoutRequested: false,
          approved: false,
          mediaType: data.mediaType || 'text',
          mediaUrl: data.mediaUrl || null,
        },
      });

      // Set cooldown in Redis
      await CooldownService.setCooldown(userId, trustInfo.tier);

      // Increment daily request count in Redis
      await CooldownService.incrementDailyRequestCount(userId);

      // Upsert user stats
      await prisma.userStats.upsert({
        where: { userId },
        update: { requestsCount: { increment: 1 } },
        create: { userId, requestsCount: 1, totalReceived: 0, totalDonated: 0, abuseFlags: 0 },
      });

      // Invalidate trust score cache
      await TrustScoreService.invalidateTrustScoreCache(userId);

      // Upsert user trust
      await prisma.userTrust.upsert({
        where: { userId },
        update: { lastRequestAt: new Date() },
        create: { userId, lastRequestAt: new Date() },
      });

      logger.info('Beg created successfully', {
        begId: beg.id,
        userId,
        amount: data.amountRequested,
        categoryId: data.categoryId,
        expiryHours,
        hasDescription: !!data.description,
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

  /**
   * Extend a beg to a new expiry duration
   * No cooldown check — extending is not creating a new request
   */
  static async extendBeg(begId: string, userId: string, expiryHours: 24 | 72 | 168): Promise<IBeg> {
    try {
      const beg = await prisma.beg.findUnique({ where: { id: begId } });

      if (!beg) throw new Error('Beg not found');
      if (beg.userId !== userId) throw new Error('Unauthorized to extend this beg');
      if (beg.status !== 'active') throw new Error('Can only extend active begs');
      if (!VALID_EXPIRY_HOURS.includes(expiryHours as any)) {
        throw new Error('Invalid expiry hours. Must be 24, 72, or 168');
      }
      if (expiryHours <= beg.expiryHours) {
        throw new Error(`New expiry must be greater than current expiry of ${beg.expiryHours} hours`);
      }

      const newExpiresAt = new Date();
      newExpiresAt.setHours(newExpiresAt.getHours() + expiryHours);

      const updated = await prisma.beg.update({
        where: { id: begId },
        data: { expiryHours, expiresAt: newExpiresAt },
      });

      logger.info('Beg extended', { begId, userId, from: beg.expiryHours, to: expiryHours });

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
        isWithdrawn: updated.isWithdrawn,
        withdrawnAt: updated.withdrawnAt,
        mediaType: updated.mediaType,
        mediaUrl: updated.mediaUrl,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    } catch (error: any) {
      logger.error('Failed to extend beg', { error: error.message, begId, userId });
      throw error;
    }
  }

  /**
   * Notify begs expiring within 1 hour (cron job — triggers extension prompt)
   */
  static async notifyExpiringBegs(): Promise<void> {
    try {
      const soon = new Date();
      soon.setHours(soon.getHours() + 1);

      const expiringBegs = await prisma.beg.findMany({
        where: {
          status: 'active',
          approved: true,
          expiryHours: { in: [24, 72] }, // only short-expiry begs
          expiresAt: { lte: soon, gt: new Date() },
        },
        select: { id: true, userId: true, expiryHours: true, expiresAt: true },
      });

      for (const beg of expiringBegs) {
        // TODO: send push notification / email to user
        // "Your beg is expiring soon! Extend it to keep it live."
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

  /**
   * Update a beg
   */
  static async updateBeg(begId: string, data: IUpdateBegRequest): Promise<IBegResponse> {
    try {
      if (data.description !== undefined && data.description !== null) {
        this.validateDescription(data.description);
      }

      const updateData: any = {};

      if (data.description !== undefined) {
        updateData.description = data.description ? data.description.trim() : null;
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
            select: {
              username: true,
              profile: {
                select: { displayName: true, firstName: true, lastName: true, isAnonymous: true },
              },
            },
          },
        },
      });

      logger.info('Beg updated successfully', { begId, updatedFields: Object.keys(updateData) });

      return this.transformBegResponse(updatedBeg as IBegWithRelations);
    } catch (error: any) {
      logger.error('Failed to update beg', { error: error.message, begId });
      throw error;
    }
  }

  /**
   * Get all active begs (feed)
   */
  static async getActiveBegs(
    page: number = 1,
    limit: number = 20,
    categoryId?: string
  ): Promise<{ begs: IBegResponse[]; total: number; pages: number }> {
    try {
      const skip = (page - 1) * limit;
      const where: any = {
        status: 'active',
        approved: true,
        expiresAt: { gt: new Date() },
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
              select: {
                username: true,
                profile: {
                  select: { displayName: true, firstName: true, lastName: true, isAnonymous: true },
                },
              },
            },
          },
        }),
        prisma.beg.count({ where }),
      ]);

      return {
        begs: begs.map((beg: any) => this.transformBegResponse(beg)),
        total,
        pages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      logger.error('Failed to get active begs', { error: error.message });
      throw error;
    }
  }

  /**
   * Get beg by ID
   */
  static async getBegById(begId: string): Promise<IBegResponse | null> {
    try {
      const beg = await prisma.beg.findUnique({
        where: { id: begId },
        include: {
          category: true,
          user: {
            select: {
              username: true,
              profile: {
                select: { displayName: true, firstName: true, lastName: true, isAnonymous: true },
              },
            },
          },
        },
      });

      if (!beg) return null;
      return this.transformBegResponse(beg as any);
    } catch (error: any) {
      logger.error('Failed to get beg by ID', { error: error.message, begId });
      return null;
    }
  }

  /**
   * Get user's begs
   */
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
              select: {
                username: true,
                profile: {
                  select: { displayName: true, firstName: true, lastName: true, isAnonymous: true },
                },
              },
            },
          },
        }),
        prisma.beg.count({ where: { userId } }),
      ]);

      return {
        begs: begs.map((beg: any) => this.transformBegResponse(beg)),
        total,
        pages: Math.ceil(total / limit),
      };
    } catch (error: any) {
      logger.error('Failed to get user begs', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Update beg status
   */
  static async updateBegStatus(begId: string, status: BegStatus): Promise<IBeg> {
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
        isWithdrawn: beg.isWithdrawn,
        withdrawnAt: beg.withdrawnAt,
        mediaType: beg.mediaType,
        mediaUrl: beg.mediaUrl,
        createdAt: beg.createdAt,
        updatedAt: beg.updatedAt,
      };
    } catch (error: any) {
      logger.error('Failed to update beg status', { error: error.message, begId });
      throw error;
    }
  }

  /**
   * Cancel user's own beg
   */
  static async cancelBeg(userId: string, begId: string): Promise<void> {
    try {
      const beg = await prisma.beg.findUnique({ where: { id: begId } });

      if (!beg) throw new Error('Beg not found');
      if (beg.userId !== userId) throw new Error('Unauthorized to cancel this beg');
      if (beg.status !== 'active') throw new Error('Can only cancel active begs');
      if (Number(beg.amountRaised) > 0) throw new Error('Cannot cancel beg that has received donations');

      await prisma.beg.update({ where: { id: begId }, data: { status: 'cancelled' } });

      logger.info('Beg cancelled by user', { begId, userId });
    } catch (error: any) {
      logger.error('Failed to cancel beg', { error: error.message, begId, userId });
      throw error;
    }
  }

  /**
   * Check and expire old begs (cron job)
   */
  static async expireOldBegs(): Promise<number> {
    try {
      const result = await prisma.beg.updateMany({
        where: { status: 'active', expiresAt: { lt: new Date() } },
        data: { status: 'expired' },
      });

      logger.info('Old begs expired', { count: result.count });
      return result.count;
    } catch (error: any) {
      logger.error('Failed to expire old begs', { error: error.message });
      return 0;
    }
  }

  /**
   * Transform beg to response format
   */
  private static transformBegResponse(beg: any): IBegResponse {
    const now = new Date();
    const timeRemaining = this.calculateTimeRemaining(beg.expiresAt, now);
    const percentFunded =
      Number(beg.amountRequested) > 0
        ? Math.round((Number(beg.amountRaised) / Number(beg.amountRequested)) * 100)
        : 0;

    const isAnonymous = beg.user?.profile?.isAnonymous || false;
    const firstNameRaw = beg.user?.profile?.firstName?.trim();
    const lastNameRaw = beg.user?.profile?.lastName?.trim();

    return {
      id: beg.id,
      userId: beg.userId,
      username: isAnonymous ? 'Anonymous' : beg.user?.profile?.displayName || beg.user.username,
      displayName: beg.user?.profile?.displayName || undefined,
      isAnonymous,
      firstName: isAnonymous ? undefined : firstNameRaw || undefined,
      lastName: isAnonymous ? undefined : lastNameRaw || undefined,
      description: beg.description,
      expiryHours: beg.expiryHours,
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

  /**
   * Calculate time remaining
   */
  private static calculateTimeRemaining(expiresAt: Date, now: Date): string {
    const diff = expiresAt.getTime() - now.getTime();
    if (diff <= 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h`;

    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${minutes}m`;
  }
}
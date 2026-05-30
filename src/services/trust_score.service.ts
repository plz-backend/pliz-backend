import prisma from '../config/database';
import {
  ITrustScore,
  ITrustProgress,
  TrustTier,
} from '../modules/Beg/types/beg.interface';
import {
  getTrustTierConfig,
  getNextTierConfig,
} from '../config/trust_tiers';
import logger from '../config/logger';
import redisClient from '../config/redis';


 // ============================================
  // GET USER TIER
  // Determined purely by:
  // → KYC verification status
  // → Total amount donated
  //
  // Tier 1 → Newcomer     (default)
  // Tier 2 → Verified User (verified + any donation)
  // Tier 3 → Trusted User  (verified + ₦10k donated)
  // Tier 4 → Super User    (verified + ₦50k donated)
  // ============================================


export class TrustScoreService {
  private static CACHE_PREFIX = 'trust_score:';
  private static CACHE_TTL = 3600; // 1 hour

  // ============================================
  // GET USER TIER
  // Cached in Redis for 1 hour
  // ============================================
  static async getUserTier(userId: string): Promise<number> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}tier:${userId}`;

      // Check cache first
      const cached = await redisClient.getClient().get(cacheKey);
      if (cached) {
        logger.info('User tier loaded from cache', { userId });
        return parseInt(cached);
      }

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

      // ── Tier 4: Super User ────────────────────
      // verified + donated ≥ ₦50,000
      if (isVerified && totalDonated >= 50000) {
        await this.cacheTier(cacheKey, 4);
        return 4;
      }

      // ── Tier 3: Trusted User ──────────────────
      // verified + donated ≥ ₦10,000
      if (isVerified && totalDonated >= 10000) {
        await this.cacheTier(cacheKey, 3);
        return 3;
      }

      // ── Tier 2: Verified User ─────────────────
      // verified + any donation
      if (isVerified && hasDonated) {
        await this.cacheTier(cacheKey, 2);
        return 2;
      }

      // ── Tier 1: Newcomer ──────────────────────
      await this.cacheTier(cacheKey, 1);
      return 1;
    } catch (error) {
      logger.error('Failed to get user tier', { error, userId });
      return 1;
    }
  }

  // ============================================
  // GET USER TRUST INFO
  // Cached in Redis for 1 hour
  // ============================================
  static async getUserTrustInfo(userId: string): Promise<ITrustScore> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}info:${userId}`;

      // Check cache first
      const cached = await redisClient.getClient().get(cacheKey);
      if (cached) {
        logger.info('User trust info loaded from cache', { userId });
        return JSON.parse(cached);
      }

      const tier = await this.getUserTier(userId);
      const tierConfig = getTrustTierConfig(tier);

      const trustInfo: ITrustScore = {
        score: 0,
        tier: tier as TrustTier,
        tierName: tierConfig.name,
        badge: tierConfig.badge,
        description: tierConfig.description,
        maxAmount: tierConfig.maxAmount,
        requestsPerDay: tierConfig.requestsPerDay,
        cooldownHours: tierConfig.cooldownHours,
        cooldownDays: tierConfig.cooldownDays,
      };

      // Cache for 1 hour
      await redisClient.getClient().setEx(
        cacheKey,
        this.CACHE_TTL,
        JSON.stringify(trustInfo)
      );

      logger.info('User trust info cached', { userId, tier });

      return trustInfo;
    } catch (error) {
      logger.error('Failed to get user trust info', { error, userId });
      const defaultConfig = getTrustTierConfig(1);
      return {
        score: 0,
        tier: 1,
        tierName: defaultConfig.name,
        badge: defaultConfig.badge,
        description: defaultConfig.description,
        maxAmount: defaultConfig.maxAmount,
        requestsPerDay: defaultConfig.requestsPerDay,
        cooldownHours: defaultConfig.cooldownHours,
        cooldownDays: defaultConfig.cooldownDays,
      };
    }
  }

  // ============================================
  // GET TRUST PROGRESS
  // Cached in Redis for 1 hour
  // ============================================
  static async getTrustProgress(userId: string): Promise<ITrustProgress> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}progress:${userId}`;

      // Check cache first
      const cached = await redisClient.getClient().get(cacheKey);
      if (cached) {
        logger.info('Trust progress loaded from cache', { userId });
        return JSON.parse(cached);
      }

      const [verification, stats] = await Promise.all([
        prisma.userVerification.findUnique({
          where: { userId },
          select: {
            isVerified: true,
            phoneVerified: true,
            documentVerified: true,
          },
        }),
        prisma.userStats.findUnique({
          where: { userId },
          select: {
            totalDonated: true,
            abuseFlags: true,
          },
        }),
      ]);

      const isVerified = verification?.isVerified || false;
      const totalDonated = stats?.totalDonated
        ? Number(stats.totalDonated)
        : 0;
      const hasDonated = totalDonated > 0;

      const currentTier = await this.getUserTier(userId);
      const currentTierConfig = getTrustTierConfig(currentTier);
      const nextTierConfig = getNextTierConfig(currentTier);

      // ── PROGRESS + NEXT TIER REQUIREMENTS ────
      const nextTierRequirements: string[] = [];
      let progressPercentage = 0;

      if (currentTier === 1) {
        // Newcomer → Verified User
        // Need: KYC + any donation
        if (!isVerified) {
          nextTierRequirements.push(
            'Complete KYC identity verification'
          );
        }
        if (!hasDonated) {
          nextTierRequirements.push(
            'Make at least 1 donation of any amount'
          );
        }
        const completedSteps = [isVerified, hasDonated].filter(Boolean).length;
        progressPercentage = Math.round((completedSteps / 2) * 100);

      } else if (currentTier === 2) {
        // Verified User → Trusted User
        // Need: total donated ≥ ₦10,000
        const needed = 10000;
        progressPercentage = Math.min(
          100,
          Math.round((totalDonated / needed) * 100)
        );
        if (totalDonated < needed) {
          const remaining = (needed - totalDonated).toLocaleString();
          nextTierRequirements.push(
            `Donate ₦${remaining} more (₦${totalDonated.toLocaleString()} of ₦${needed.toLocaleString()} donated)`
          );
        }

      } else if (currentTier === 3) {
        // Trusted User → Super User
        // Need: total donated ≥ ₦50,000
        const needed = 50000;
        progressPercentage = Math.min(
          100,
          Math.round((totalDonated / needed) * 100)
        );
        if (totalDonated < needed) {
          const remaining = (needed - totalDonated).toLocaleString();
          nextTierRequirements.push(
            `Donate ₦${remaining} more (₦${totalDonated.toLocaleString()} of ₦${needed.toLocaleString()} donated)`
          );
        }

      } else if (currentTier === 4) {
        // Super User — max tier for MVP
        progressPercentage = 100;
      }

      const recommendations = this.generateRecommendations(
        currentTier,
        isVerified,
        hasDonated,
        totalDonated,
        verification
      );

      const progress: ITrustProgress = {
        currentScore: 0,
        currentTier: currentTier as TrustTier,
        currentTierName: currentTierConfig.name,
        currentTierBadge: currentTierConfig.badge,
        nextTier: nextTierConfig
          ? (nextTierConfig.tier as TrustTier)
          : null,
        nextTierName: nextTierConfig ? nextTierConfig.name : null,
        nextTierBadge: nextTierConfig ? nextTierConfig.badge : null,
        pointsToNextTier: null,
        progressPercentage,
        capabilities: {
          maxAmount: currentTierConfig.maxAmount,
          requestsPerDay: currentTierConfig.requestsPerDay,
          cooldownHours: currentTierConfig.cooldownHours,
          cooldownDays: currentTierConfig.cooldownDays,
        },
        nextCapabilities: nextTierConfig
          ? {
              maxAmount: nextTierConfig.maxAmount,
              requestsPerDay: nextTierConfig.requestsPerDay,
              cooldownHours: nextTierConfig.cooldownHours,
              cooldownDays: nextTierConfig.cooldownDays,
            }
          : null,
        breakdown: {
          isVerified,
          hasDonated,
          totalDonated,
          phoneVerified: verification?.phoneVerified || false,
          documentVerified: verification?.documentVerified || false,
          abuseFlags: stats?.abuseFlags || 0,
        },
        nextTierRequirements,
        recommendations,
        isMaxTier: currentTier === 4,
      };

      // Cache for 1 hour
      await redisClient.getClient().setEx(
        cacheKey,
        this.CACHE_TTL,
        JSON.stringify(progress)
      );

      logger.info('Trust progress cached', { userId, tier: currentTier });

      return progress;
    } catch (error) {
      logger.error('Failed to get trust progress', { error, userId });
      throw error;
    }
  }

  // ============================================
  // INVALIDATE ALL TRUST CACHES FOR USER
  // Call this when:
  // → User completes KYC
  // → User makes a donation
  // → User is flagged/unflagged
  // ============================================
  static async invalidateTrustScoreCache(userId: string): Promise<void> {
    try {
      await Promise.all([
        redisClient.getClient().del(`${this.CACHE_PREFIX}tier:${userId}`),
        redisClient.getClient().del(`${this.CACHE_PREFIX}info:${userId}`),
        redisClient.getClient().del(`${this.CACHE_PREFIX}progress:${userId}`),
      ]);
      logger.info('Trust score cache invalidated', { userId });
    } catch (error) {
      logger.error('Failed to invalidate trust score cache', {
        error,
        userId,
      });
    }
  }

  // ============================================
  // RECALCULATE TRUST SCORE
  // Compatibility entrypoint used by donation + queue processors.
  // Trust level is tier-based, so recalculation refreshes caches and
  // persists the latest tier in user_trust.
  // ============================================
  static async calculateTrustScore(userId: string): Promise<ITrustScore> {
    await this.invalidateTrustScoreCache(userId);
    const trustInfo = await this.getUserTrustInfo(userId);

    await prisma.userTrust.upsert({
      where: { userId },
      create: { userId, trustTier: trustInfo.tier },
      update: { trustTier: trustInfo.tier },
    });

    logger.info('Trust score recalculated', {
      userId,
      tier: trustInfo.tier,
    });

    return trustInfo;
  }

  // ============================================
  // INITIALIZE USER TRUST
  // Called when user registers
  // ============================================
  static async initializeUserTrust(userId: string): Promise<void> {
    try {
      await Promise.all([
        prisma.userStats.create({ data: { userId } }),
        prisma.userTrust.create({ data: { userId, trustTier: 1 } }),
      ]);
      logger.info('User trust initialized', { userId });
    } catch (error) {
      logger.error('Failed to initialize user trust', { error, userId });
    }
  }

  // ============================================
  // CACHE TIER HELPER
  // ============================================
  private static async cacheTier(
    cacheKey: string,
    tier: number
  ): Promise<void> {
    try {
      await redisClient
        .getClient()
        .setEx(cacheKey, this.CACHE_TTL, tier.toString());
    } catch (error) {
      logger.error('Failed to cache tier', { error });
    }
  }

  // ============================================
  // GENERATE RECOMMENDATIONS
  // ============================================
  private static generateRecommendations(
    currentTier: number,
    isVerified: boolean,
    hasDonated: boolean,
    totalDonated: number,
    verification: any
  ): string[] {
    const recs: string[] = [];

    if (!verification?.phoneVerified) {
      recs.push('Verify your phone number');
    }

    if (!isVerified) {
      recs.push(
        'Complete KYC identity verification to unlock requests above ₦10,000'
      );
    }

    if (isVerified && !hasDonated) {
      recs.push(
        'Make your first donation (any amount) to move to ✅ Verified User and request up to ₦50,000'
      );
    }

    if (currentTier === 2 && totalDonated < 10000) {
      const remaining = (10000 - totalDonated).toLocaleString();
      recs.push(
        `Donate ₦${remaining} more in total to reach ⭐ Trusted User and request up to ₦100,000`
      );
    }

    if (currentTier === 3 && totalDonated < 50000) {
      const remaining = (50000 - totalDonated).toLocaleString();
      recs.push(
        `Donate ₦${remaining} more in total to reach 👑 Super User and request up to ₦200,000`
      );
    }

    if (currentTier === 4) {
      recs.push(
        '👑 You have reached the maximum tier! Keep donating and helping others!'
      );
    }

    return recs;
  }
}

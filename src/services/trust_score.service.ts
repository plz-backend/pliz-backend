import prisma from '../config/database';
import { ITrustScore, ITrustProgress } from '../modules/Beg/types/beg.interface';
import { getTrustTierConfig } from '../config/trust_tiers';
import logger from '../config/logger';
import redisClient from '../config/redis';

/**
 * Trust Score Service with Redis Caching
 * Calculates and manages user trust scores
 */
export class TrustScoreService {
  private static CACHE_PREFIX = 'trust_score:';
  private static CACHE_TTL = 3600; // 1 hour

  /**
   * Calculate trust score for a user
   * Based on: successful begs, donations given, verification, community reports
   */
  static async calculateTrustScore(userId: string): Promise<number> {
    try {
      // Check cache first
      const cacheKey = `${this.CACHE_PREFIX}${userId}`;
      const cached = await redisClient.getClient().get(cacheKey);
      
      if (cached) {
        logger.info('Trust score retrieved from cache', { userId });
        return parseInt(cached);
      }

      // Get user stats
      const stats = await prisma.userStats.findUnique({
        where: { userId },
      });

      // Get user trust
      const trust = await prisma.userTrust.findUnique({
        where: { userId },
      });

      // Get verification status
      const verification = await prisma.userVerification.findUnique({
        where: { userId },
      });

      let score = 0;

      // Base score from successful begs
      if (stats) {
        score += Math.min(stats.requestsCount * 5, 30); // Max 30 points

        // Points for donations given (give back bonus)
        if (stats.totalDonated && stats.totalDonated.gt(0)) {
          score += 15;
        }

        // Penalty for abuse flags
        score -= stats.abuseFlags * 20;
      }

      // Verification bonus
      if (verification) {
        if (verification.phoneVerified) score += 5;
        if (verification.documentVerified) score += 10;
        // if (verification.addressVerified) score += 5;
      }

      // Ensure score is between 0 and 100
      score = Math.max(0, Math.min(100, score));

      // Update trust score in database
      if (trust) {
        await prisma.userTrust.update({
          where: { userId },
          data: { trustTier: this.getTierFromScore(score) },
        });
      } else {
        await prisma.userTrust.create({
          data: {
            userId,
            trustTier: this.getTierFromScore(score),
          },
        });
      }

      // Cache the score for 1 hour
      await redisClient.getClient().setEx(cacheKey, this.CACHE_TTL, score.toString());

      logger.info('Trust score calculated and cached', { userId, score });

      return score;
    } catch (error) {
      logger.error('Failed to calculate trust score', { error, userId });
      return 0;
    }
  }

  /**
   * Invalidate trust score cache (call when stats change)
   */
  static async invalidateTrustScoreCache(userId: string): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${userId}`;
      await redisClient.getClient().del(cacheKey);
      logger.info('Trust score cache invalidated', { userId });
    } catch (error) {
      logger.error('Failed to invalidate trust score cache', { error, userId });
    }
  }

  /**
   * Get trust tier from score
   */
  static getTierFromScore(score: number): number {
    if (score >= 75) return 3; // Super Asker
    if (score >= 50) return 3; // Trusted User
    if (score >= 20) return 2; // Verified Beginner
    return 1; // Newcomer
  }

  /**
   * Get next tier threshold
   * ✅ ADD THIS METHOD
   */
  static getNextTierThreshold(currentScore: number): { tier: number; threshold: number } | null {
    if (currentScore < 20) return { tier: 2, threshold: 20 };
    if (currentScore < 50) return { tier: 3, threshold: 50 };
    if (currentScore < 75) return { tier: 3, threshold: 75 }; // Super asker level
    return null; // Max tier reached
  }

  /**
   * Get tier range (min-max scores for a tier)
   * ✅ ADD THIS METHOD
   */
  private static getTierRange(tier: number): { min: number; max: number } {
    if (tier === 1) return { min: 0, max: 19 };
    if (tier === 2) return { min: 20, max: 49 };
    if (tier === 3) return { min: 50, max: 100 };
    return { min: 0, max: 100 };
  }

  /**
   * Generate recommendations for leveling up
   * ✅ ADD THIS METHOD
   */
  private static generateRecommendations(
    currentScore: number,
    breakdown: any,
    verification: any
  ): string[] {
    const recommendations: string[] = [];

    // Email verification
    if (breakdown.emailVerified === 0) {
      recommendations.push('Verify your email to earn +5 points');
    }

    // Phone verification
    if (!verification?.phoneVerified) {
      recommendations.push('Verify your phone number to earn +5 points');
    }

    // Document verification
    if (!verification?.documentVerified) {
      recommendations.push('Complete ID verification to earn +10 points');
    }

    // Address verification
    if (!verification?.addressVerified) {
      recommendations.push('Verify your address to earn +5 points');
    }

    // Give back bonus
    if (breakdown.giveBackBonus === 0) {
      recommendations.push('Donate to someone to earn +15 points (give back bonus)');
    }

    // Create more successful begs
    if (breakdown.successfulBegs < 30) {
      const begsNeeded = Math.ceil((30 - breakdown.successfulBegs) / 5);
      recommendations.push(
        `Create ${begsNeeded} more successful beg${begsNeeded > 1 ? 's' : ''} to maximize this category (+${30 - breakdown.successfulBegs} points available)`
      );
    }

    // If no recommendations, user is maxed out
    if (recommendations.length === 0 && currentScore < 100) {
      recommendations.push('Keep creating successful begs and helping others to maintain your tier!');
    }

    return recommendations;
  }

  /**
   * Get detailed trust progress information
   * ✅ ADD THIS METHOD - THE MAIN ONE YOU'RE MISSING
   */
  static async getTrustProgress(userId: string): Promise<ITrustProgress> {
    try {
      // Calculate current score
      const currentScore = await this.calculateTrustScore(userId);
      const currentTier = this.getTierFromScore(currentScore);
      const currentTierConfig = getTrustTierConfig(currentTier);

      // Get stats for breakdown
      const stats = await prisma.userStats.findUnique({ where: { userId } });
      const verification = await prisma.userVerification.findUnique({ where: { userId } });

      // Calculate breakdown
      const breakdown = {
        successfulBegs: stats ? Math.min(stats.requestsCount * 5, 30) : 0,
        giveBackBonus: stats && stats.totalDonated && stats.totalDonated.gt(0) ? 15 : 0,
        emailVerified: 0,
        phoneVerified: verification?.phoneVerified ? 5 : 0,
        documentVerified: verification?.documentVerified ? 10 : 0,
        // addressVerified: verification?.addressVerified ? 5 : 0,
        penalties: stats ? stats.abuseFlags * -20 : 0,
      };

      // Get email verification status from user
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isEmailVerified: true },
      });
      breakdown.emailVerified = user?.isEmailVerified ? 5 : 0;

      // Calculate next tier info
      const nextTierInfo = this.getNextTierThreshold(currentScore);
      let nextCapabilities = null;
      let pointsToNextTier = null;
      let progressPercentage = 0;

      if (nextTierInfo) {
        const nextTierConfig = getTrustTierConfig(nextTierInfo.tier);
        nextCapabilities = {
          maxAmount: nextTierConfig.maxAmount,
          requestsPerDay: nextTierConfig.requestsPerDay,
          cooldownHours: nextTierConfig.cooldownHours,
        };
        pointsToNextTier = nextTierInfo.threshold - currentScore;
        
        // Calculate progress percentage within current tier range
        const currentThresholds = this.getTierRange(currentTier);
        const rangeSize = nextTierInfo.threshold - currentThresholds.min;
        const currentProgress = currentScore - currentThresholds.min;
        progressPercentage = Math.round((currentProgress / rangeSize) * 100);
      } else {
        // Max tier reached
        progressPercentage = 100;
      }

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        currentScore,
        breakdown,
        verification
      );

      return {
        currentScore,
        currentTier,
        currentTierName: currentTierConfig.name,
        nextTier: nextTierInfo?.tier || null,
        nextTierName: nextTierInfo ? getTrustTierConfig(nextTierInfo.tier).name : null,
        pointsToNextTier,
        progressPercentage,
        capabilities: {
          maxAmount: currentTierConfig.maxAmount,
          requestsPerDay: currentTierConfig.requestsPerDay,
          cooldownHours: currentTierConfig.cooldownHours,
        },
        nextCapabilities,
        breakdown,
        recommendations,
      };
    } catch (error) {
      logger.error('Failed to get trust progress', { error, userId });
      throw error;
    }
  }

  /**
   * Get user's trust score and tier info
   */
  static async getUserTrustInfo(userId: string): Promise<ITrustScore> {
    try {
      const score = await this.calculateTrustScore(userId);
      const tier = this.getTierFromScore(score);
      const tierConfig = getTrustTierConfig(tier);

      return {
        score,
        tier: tier as 1 | 2 | 3,
        tierName: tierConfig.name,
        maxAmount: tierConfig.maxAmount,
        requestsPerDay: tierConfig.requestsPerDay,
        cooldownHours: tierConfig.cooldownHours,
      };
    } catch (error) {
      logger.error('Failed to get user trust info', { error, userId });
      // Return default (tier 1)
      const defaultConfig = getTrustTierConfig(1);
      return {
        score: 0,
        tier: 1,
        tierName: defaultConfig.name,
        maxAmount: defaultConfig.maxAmount,
        requestsPerDay: defaultConfig.requestsPerDay,
        cooldownHours: defaultConfig.cooldownHours,
      };
    }
  }

  /**
   * Initialize trust for new user
   */
  static async initializeUserTrust(userId: string): Promise<void> {
    try {
      // Create user stats
      await prisma.userStats.create({
        data: { userId },
      });

      // Create user trust
      await prisma.userTrust.create({
        data: {
          userId,
          trustTier: 1, // Start at tier 1
        },
      });

      logger.info('User trust initialized', { userId });
    } catch (error) {
      logger.error('Failed to initialize user trust', { error, userId });
    }
  }
}
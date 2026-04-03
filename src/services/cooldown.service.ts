import prisma from '../config/database';
import { ICooldownInfo } from '../modules/Beg/types/beg.interface';
import { getTrustTierConfig } from '../config/trust_tiers';
import logger from '../config/logger';
import redisClient from '../config/redis';

/**
 * Cooldown Service with Redis
 * Manages request cooldown periods using Redis for speed
 */
export class CooldownService {
  private static COOLDOWN_PREFIX = 'cooldown:';
  private static REQUEST_COUNT_PREFIX = 'req_count:';

  /**
   * Check if user is on cooldown
   */
  static async checkCooldown(userId: string): Promise<ICooldownInfo> {
    try {
      const cacheKey = `${this.COOLDOWN_PREFIX}${userId}`;
      const cooldownTimestamp = await redisClient.getClient().get(cacheKey);

      if (!cooldownTimestamp) {
        return {
          isOnCooldown: false,
          nextRequestAllowedAt: null,
        };
      }

      const nextRequestAllowedAt = new Date(parseInt(cooldownTimestamp));
      const now = new Date();
      const isOnCooldown = nextRequestAllowedAt > now;

      if (isOnCooldown) {
        const hoursRemaining = Math.ceil(
          (nextRequestAllowedAt.getTime() - now.getTime()) / (1000 * 60 * 60)
        );

        return {
          isOnCooldown: true,
          nextRequestAllowedAt,
          hoursRemaining,
          message: `You can make your next request in ${hoursRemaining} hours`,
        };
      }

      // Cooldown expired, clean up
      await redisClient.getClient().del(cacheKey);

      return {
        isOnCooldown: false,
        nextRequestAllowedAt: null,
      };
    } catch (error) {
      logger.error('Failed to check cooldown', { error, userId });
      return {
        isOnCooldown: false,
        nextRequestAllowedAt: null,
      };
    }
  }

  /**
   * Set cooldown for user
   */
  static async setCooldown(userId: string, trustTier: number): Promise<void> {
    try {
      const tierConfig = getTrustTierConfig(trustTier);
      const nextRequestAllowedAt = new Date();
      nextRequestAllowedAt.setHours(
        nextRequestAllowedAt.getHours() + tierConfig.cooldownHours
      );

      const cacheKey = `${this.COOLDOWN_PREFIX}${userId}`;
      const ttlSeconds = tierConfig.cooldownHours * 60 * 60;

      // Store timestamp in Redis with TTL
      await redisClient.getClient().setEx(
        cacheKey,
        ttlSeconds,
        nextRequestAllowedAt.getTime().toString()
      );

      logger.info('Cooldown set in Redis', {
        userId,
        nextRequestAllowedAt,
        hours: tierConfig.cooldownHours,
      });
    } catch (error) {
      logger.error('Failed to set cooldown', { error, userId });
    }
  }

  /**
   * Clear cooldown for user
   */
  static async clearCooldown(userId: string): Promise<void> {
    try {
      const cacheKey = `${this.COOLDOWN_PREFIX}${userId}`;
      await redisClient.getClient().del(cacheKey);

      logger.info('Cooldown cleared from Redis', { userId });
    } catch (error) {
      logger.error('Failed to clear cooldown', { error, userId });
    }
  }

  /**
   * Check daily request count (for tier-based limits)
   */
  static async checkDailyRequestCount(
    userId: string,
    trustTier: number
  ): Promise<{ canRequest: boolean; requestsToday: number; limit: number }> {
    try {
      const tierConfig = getTrustTierConfig(trustTier);
      const countKey = `${this.REQUEST_COUNT_PREFIX}${userId}`;
      
      const count = await redisClient.getClient().get(countKey);
      const requestsToday = count ? parseInt(count) : 0;

      return {
        canRequest: requestsToday < tierConfig.requestsPerDay,
        requestsToday,
        limit: tierConfig.requestsPerDay,
      };
    } catch (error) {
      logger.error('Failed to check daily request count', { error, userId });
      return {
        canRequest: true, // Fail open
        requestsToday: 0,
        limit: 1,
      };
    }
  }

  /**
   * Increment daily request count
   */
  static async incrementDailyRequestCount(userId: string): Promise<void> {
    try {
      const countKey = `${this.REQUEST_COUNT_PREFIX}${userId}`;
      
      const count = await redisClient.getClient().get(countKey);
      
      if (count) {
        await redisClient.getClient().incr(countKey);
      } else {
        // Set with 24-hour expiry (resets at midnight)
        const now = new Date();
        const midnight = new Date(now);
        midnight.setHours(24, 0, 0, 0);
        const ttlSeconds = Math.floor((midnight.getTime() - now.getTime()) / 1000);
        
        await redisClient.getClient().setEx(countKey, ttlSeconds, '1');
      }

      logger.info('Daily request count incremented', { userId });
    } catch (error) {
      logger.error('Failed to increment request count', { error, userId });
    }
  }
}

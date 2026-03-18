import prisma from '../../../config/database';
import redisClient from '../../../config/redis';
import logger from '../../../config/logger';

const DONOR_RANKS = [
  { name: 'Ultimate Giver', minTotal: 1000000, minCount: 0  },
  { name: "Heaven's Plug",  minTotal: 500000,  minCount: 10 },
  { name: 'VIP Donor',      minTotal: 250000,  minCount: 0  },
  { name: 'Sugar Daddy',    minTotal: 150000,  minCount: 0  },
  { name: 'Blesser',        minTotal: 100000,  minCount: 5  },
  { name: 'Plug',           minTotal: 50000,   minCount: 5  },
  { name: 'Baller',         minTotal: 50000,   minCount: 0  },
  { name: 'Sapa Rescuer',   minTotal: 20000,   minCount: 5  },
  { name: 'Viber',          minTotal: 0,       minCount: 3  },
  { name: 'Tryer',          minTotal: 0,       minCount: 1  },
];

const CACHE_PREFIX = 'donor_rank:';
const CACHE_TTL = 3600; // 1 hour

export class DonorRankService {
  /**
   * Calculate rank name from total donated and donation count
   */
  static calculateRankName(totalDonated: number, donationCount: number): string {
    for (const rank of DONOR_RANKS) {
      if (totalDonated >= rank.minTotal && donationCount >= rank.minCount) {
        return rank.name;
      }
    }
    return 'Tryer';
  }

  /**
   * Update donor rank after a confirmed donation
   *
   * HOW IT WORKS:
   * 1. Read current donor_ranks row from DB
   * 2. Create row if first ever donation
   * 3. Calculate streak (donated yesterday = +1, else reset to 1)
   * 4. Calculate new totals (from DB data + new donation)
   * 5. Recalculate rank name from new totals
   * 6. Save everything back to DB
   * 7. Invalidate Redis cache
   */
  static async updateAfterDonation(
    userId: string,
    donationAmount: number
  ): Promise<void> {
    try {
      // Read from DB
      let donorRank = await prisma.donorRank.findUnique({
        where: { userId },
      });

      // Create if first donation
      if (!donorRank) {
        donorRank = await prisma.donorRank.create({
          data: {
            userId,
            rankName: 'Tryer',
            totalDonated: 0,
            donationCount: 0,
            streakDays: 0,
          },
        });
      }

      // Calculate streak from DB data
      let newStreak = 1;
      if (donorRank.lastDonatedAt) {
        const lastDate = new Date(donorRank.lastDonatedAt).toDateString();
        const todayDate = new Date().toDateString();
        const yesterdayDate = new Date(Date.now() - 86400000).toDateString();

        if (lastDate === todayDate) {
          newStreak = donorRank.streakDays;       // Already donated today
        } else if (lastDate === yesterdayDate) {
          newStreak = donorRank.streakDays + 1;   // Consecutive day
        } else {
          newStreak = 1;                          // Streak broken
        }
      }

      // New totals from DB + this donation
      const newTotal = parseFloat(donorRank.totalDonated.toString()) + donationAmount;
      const newCount = donorRank.donationCount + 1;
      const newRankName = this.calculateRankName(newTotal, newCount);

      // Save to DB
      await prisma.donorRank.update({
        where: { userId },
        data: {
          rankName: newRankName,
          totalDonated: newTotal,
          donationCount: newCount,
          streakDays: newStreak,
          lastDonatedAt: new Date(),
        },
      });

      // Invalidate cache so next read gets fresh data
      await this.invalidateCache(userId);

      logger.info('Donor rank updated', {
        userId,
        newRankName,
        newTotal,
        newCount,
        newStreak,
      });
    } catch (error: any) {
      logger.error('Failed to update donor rank', { error: error.message, userId });
    }
  }

  /**
   * Get donor rank - Redis cache with DB fallback
   */
  static async getDonorRank(userId: string): Promise<any> {
    try {
      const cacheKey = `${CACHE_PREFIX}${userId}`;

      // Check Redis first
      const cached = await redisClient.getClient().get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Read from DB
      const donorRank = await prisma.donorRank.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              username: true,
              profile: {
                select: { displayName: true, isAnonymous: true },
              },
            },
          },
        },
      });

      if (!donorRank) return null;

      const result = {
        rank_name: donorRank.rankName,
        total_donated: parseFloat(donorRank.totalDonated.toString()),
        donation_count: donorRank.donationCount,
        streak_days: donorRank.streakDays,
        last_donated_at: donorRank.lastDonatedAt,
        username: donorRank.user.profile?.isAnonymous
          ? 'Anonymous'
          : donorRank.user.profile?.displayName || donorRank.user.username,
      };

      // Cache 1 hour
      await redisClient.getClient().setEx(cacheKey, CACHE_TTL, JSON.stringify(result));

      return result;
    } catch (error: any) {
      logger.error('Failed to get donor rank', { error: error.message, userId });
      return null;
    }
  }

  static async invalidateCache(userId: string): Promise<void> {
    try {
      await redisClient.getClient().del(`${CACHE_PREFIX}${userId}`);
    } catch (error: any) {
      logger.error('Failed to invalidate donor rank cache', { error: error.message });
    }
  }
}
import prisma from '../../../config/database';
import redisClient from '../../../config/redis';
import { TrustScoreService } from '../../../services/trust_score.service';
import { DonorRankService } from './donor_rank.service';
import { NotificationService } from '../../notifications/services/notification.service';
import { PaymentMethodService } from '../../Payment/services/payment_method.service';
import { trustScoreQueue } from '../../../config/queue-manager';    // ← added
import logger from '../../../config/logger';

// Pre-defined gratitude messages
const GRATITUDE_MESSAGES: Record<1 | 2, string> = {
  1: "Thank you so much! Your kindness means the world to me. 🙏",
  2: "I'm truly grateful for your help. This makes a huge difference! ❤️",
};

const BEG_DONATIONS_CACHE_PREFIX = 'beg_donations:';
const CACHE_TTL = 300; // 5 minutes

// ============================================
// HELPER
// ============================================
const buildBegTitle = (
  category: { name: string; icon: string | null } | null,
  description: string | null
): string => {
  if (!category) return 'Help Request';
  const icon = category.icon ? ` ${category.icon}` : '';
  const desc = description ? ` — ${description}` : '';
  return `${category.name}${icon}${desc}`;
};

export class DonationService {
  /**
   * Process donation after Paystack confirms payment
   */
  static async processDonation(data: {
    begId: string;
    donorId: string;
    amount: number;
    isAnonymous: boolean;
    paymentReference: string;
    paymentMethod: string;
  }): Promise<any> {
    try {
      logger.info('Processing donation', {
        begId: data.begId,
        donorId: data.donorId,
        amount: data.amount,
        reference: data.paymentReference,
      });

      // STEP 1: READ donations
      const donation = await prisma.donation.findFirst({
        where: { paymentReference: data.paymentReference },
        include: {
          beg: {
            select: {
              id: true,
              userId: true,
              description: true,
              category: { select: { name: true, icon: true } },
              status: true,
              amountRequested: true,
              amountRaised: true,
            },
          },
        },
      });

      if (!donation) {
        return await this.createAndProcess(data);
      }

      if (donation.status !== 'pending') {
        logger.warn('Donation already processed', {
          reference: data.paymentReference,
          status: donation.status,
        });
        return await this.getDonationWithDetails(donation.id);
      }

      // ← You are not allowed to donate to your own beg
      if (donation.beg.userId === donation.donorId) {
        throw new Error('You cannot donate to your own beg');
      }

      const donationAmount = parseFloat(donation.amount.toString());
      const recipientId = donation.beg.userId;
      const donorId = donation.donorId;

      // STEPS 2-8: All inside $transaction
      const result = await prisma.$transaction(async (tx) => {
        // STEP 2: UPDATE donations.status → 'success'
        await tx.donation.update({
          where: { id: donation.id },
          data: { status: 'success' },
        });

        // STEP 3: UPDATE begs.amountRaised
        const updatedBeg = await tx.beg.update({
          where: { id: donation.begId },
          data: { amountRaised: { increment: donationAmount } },
        });

        // STEP 4 & 5: Check funded
        const amountRaised = parseFloat(updatedBeg.amountRaised.toString());
        const amountRequested = parseFloat(updatedBeg.amountRequested.toString());
        const isFullyFunded = amountRaised >= amountRequested;

        if (isFullyFunded) {
          await tx.beg.update({
            where: { id: donation.begId },
            data: { status: 'funded' },
          });
        }

        // STEP 6: UPSERT user_stats (recipient)
        await tx.userStats.upsert({
          where: { userId: recipientId },
          update: { totalReceived: { increment: donationAmount } },
          create: {
            userId: recipientId,
            totalReceived: donationAmount,
            totalDonated: 0,
            requestsCount: 0,
            abuseFlags: 0,
          },
        });

        // STEP 7: UPSERT user_stats (donor)
        if (donorId) {
          await tx.userStats.upsert({
            where: { userId: donorId },
            update: { totalDonated: { increment: donationAmount } },
            create: {
              userId: donorId,
              totalDonated: donationAmount,
              totalReceived: 0,
              requestsCount: 0,
              abuseFlags: 0,
            },
          });
        }

        // STEP 8: INSERT gratitude_messages
        const replyExpiresAt = new Date();
        replyExpiresAt.setHours(replyExpiresAt.getHours() + 24);

        await tx.gratitudeMessage.create({
          data: {
            donationId: donation.id,
            messageType: 1,
            donorReplyAllowed: true,
            donorReplied: false,
            expiresAt: replyExpiresAt,
          },
        });

        return { isFullyFunded, amountRaised, amountRequested };
      });

      logger.info('Transaction complete', {
        donationId: donation.id,
        isFullyFunded: result.isFullyFunded,
      });

      // STEP 9: UPDATE donor_ranks
      if (donorId) {
        await DonorRankService.updateAfterDonation(donorId, donationAmount);
      }

      // ============================================
      // STEPS 10 & 11: Invalidate trust score caches
      // Try queue first — fall back to direct if queue unavailable
      // ============================================
      try {
        await trustScoreQueue.add(
          'invalidate',
          { userId: recipientId, action: 'invalidate' },
          { jobId: `trust-invalidate-${recipientId}-${Date.now()}` }
        );

        if (donorId) {
          await trustScoreQueue.add(
            'invalidate',
            { userId: donorId, action: 'invalidate' },
            { jobId: `trust-invalidate-${donorId}-${Date.now()}` }
          );
        }

        // ============================================
        // STEP 12: Recalculate trust scores via queue
        // ============================================
        await trustScoreQueue.add(
          'recalculate',
          { userId: recipientId, action: 'recalculate' },
          { jobId: `trust-recalc-${recipientId}-${Date.now()}` }
        );

        if (donorId) {
          await trustScoreQueue.add(
            'recalculate',
            { userId: donorId, action: 'recalculate' },
            { jobId: `trust-recalc-${donorId}-${Date.now()}` }
          );
        }

        logger.info('Trust score jobs queued', { recipientId, donorId });
      } catch (queueError: any) {
        // Queue unavailable — fall back to direct processing
        logger.warn('Trust score queue unavailable, processing directly', {
          error: queueError.message,
        });

        await TrustScoreService.invalidateTrustScoreCache(recipientId);
        if (donorId) await TrustScoreService.invalidateTrustScoreCache(donorId);
        await TrustScoreService.calculateTrustScore(recipientId);
        if (donorId) await TrustScoreService.calculateTrustScore(donorId);
      }

      // STEP 13: Invalidate donor rank cache
      if (donorId) await DonorRankService.invalidateCache(donorId);

      // STEP 14: Invalidate beg donations cache
      await this.invalidateBegDonationsCache(donation.begId);

      // Get donor name for notifications
      let donorName = 'Someone';
      if (donorId && !donation.isAnonymous) {
        const donorProfile = await prisma.userProfile.findUnique({
          where: { userId: donorId },
          select: { displayName: true },
        });
        if (donorProfile?.displayName) donorName = donorProfile.displayName;
      }

      // Build beg title from category + description
      const begTitle = buildBegTitle(donation.beg.category, donation.beg.description);

      // STEP 15: Notify recipient of donation
      await NotificationService.donationReceived({
        userId: recipientId,
        begId: donation.begId,
        begTitle,
        amount: donationAmount,
        isAnonymous: donation.isAnonymous,
        donorName,
      });

      // STEP 16: Notify recipient if beg is fully funded
      if (result.isFullyFunded) {
        await NotificationService.begFunded({
          userId: recipientId,
          begId: donation.begId,
          begTitle,
          amountReceived: result.amountRequested,
        });
      }

      // STEP 17: AUTO-SAVE CARD
      if (donorId && data.paymentMethod === 'card') {
        try {
          await PaymentMethodService.saveCardFromTransaction(
            donorId,
            data.paymentReference
          );
          logger.info('Card auto-saved for donor', { donorId });
        } catch (cardError: any) {
          logger.warn('Failed to auto-save card', {
            error: cardError.message,
            donorId,
            reference: data.paymentReference,
          });
        }
      }

      logger.info('Donation processing complete - all 17 steps done', {
        donationId: donation.id,
        reference: data.paymentReference,
        isFullyFunded: result.isFullyFunded,
      });

      return await this.getDonationWithDetails(donation.id);
    } catch (error: any) {
      logger.error('Failed to process donation', {
        error: error.message,
        stack: error.stack,
        reference: data.paymentReference,
      });
      throw error;
    }
  }

  /**
   * Used when verify endpoint is called without a pending record
   */
  private static async createAndProcess(data: {
    begId: string;
    donorId: string;
    amount: number;
    isAnonymous: boolean;
    paymentReference: string;
    paymentMethod: string;
  }): Promise<any> {
    const beg = await prisma.beg.findUnique({
      where: { id: data.begId },
      select: {
        id: true,
        userId: true,
        description: true,
        category: { select: { name: true, icon: true } },
        status: true,
        amountRequested: true,
        amountRaised: true,
      },
    });

    if (!beg) throw new Error('Beg not found');
    if (beg.status !== 'active') throw new Error(`Beg status: ${beg.status}`);

    // ← ADD THIS
    if (beg.userId === data.donorId) {
      throw new Error('You cannot donate to your own beg');
    }

    await prisma.donation.create({
      data: {
        begId: data.begId,
        donorId: data.donorId,
        amount: data.amount,
        isAnonymous: data.isAnonymous,
        paymentReference: data.paymentReference,
        paymentMethod: data.paymentMethod,
        status: 'pending',
      },
    });

    return await this.processDonation(data);
  }

  /**
   * Get full donation with all relations from DB
   */
  static async getDonationWithDetails(donationId: string): Promise<any> {
    const donation = await prisma.donation.findUnique({
      where: { id: donationId },
      include: {
        beg: {
          select: {
            id: true,
            description: true,
            amountRequested: true,
            amountRaised: true,
            status: true,
            category: { select: { name: true, icon: true } },
            user: {
              select: {
                username: true,
                profile: { select: { displayName: true, isAnonymous: true } },
              },
            },
          },
        },
        donor: {
          select: {
            username: true,
            profile: { select: { displayName: true, isAnonymous: true } },
          },
        },
        gratitudeMessage: true,
      },
    });

    if (!donation) return null;

    return {
      id: donation.id,
      amount: parseFloat(donation.amount.toString()),
      is_anonymous: donation.isAnonymous,
      payment_method: donation.paymentMethod,
      payment_reference: donation.paymentReference,
      status: donation.status,
      created_at: donation.createdAt,
      beg: {
        id: donation.beg.id,
        title: buildBegTitle(donation.beg.category, donation.beg.description),
        amount_requested: parseFloat(donation.beg.amountRequested.toString()),
        amount_raised: parseFloat(donation.beg.amountRaised.toString()),
        status: donation.beg.status,
        category: donation.beg.category,
        recipient_name: donation.beg.user.profile?.isAnonymous
          ? 'Anonymous'
          : donation.beg.user.profile?.displayName || donation.beg.user.username,
      },
      donor_name: donation.isAnonymous
        ? 'Anonymous'
        : donation.donor?.profile?.displayName || donation.donor?.username,
      gratitude_message: donation.gratitudeMessage
        ? {
            id: donation.gratitudeMessage.id,
            content:
              donation.gratitudeMessage.content ||
              GRATITUDE_MESSAGES[donation.gratitudeMessage.messageType as 1 | 2],
            donor_reply_allowed: donation.gratitudeMessage.donorReplyAllowed,
            donor_replied: donation.gratitudeMessage.donorReplied,
            donor_reply: donation.gratitudeMessage.donorReply,
            expires_at: donation.gratitudeMessage.expiresAt,
          }
        : null,
    };
  }

  /**
   * Get all donations for a beg (paginated, cached)
   */
  static async getDonationsByBeg(
    begId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const cacheKey = `${BEG_DONATIONS_CACHE_PREFIX}${begId}:${page}:${limit}`;
    const cached = await redisClient.getClient().get(cacheKey);
    if (cached) {
      logger.info('Beg donations from cache', { begId });
      return JSON.parse(cached);
    }

    const skip = (page - 1) * limit;
    const [donations, total] = await Promise.all([
      prisma.donation.findMany({
        where: { begId, status: 'success' },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          donor: {
            select: {
              username: true,
              profile: { select: { displayName: true, isAnonymous: true } },
            },
          },
        },
      }),
      prisma.donation.count({ where: { begId, status: 'success' } }),
    ]);

    const result = {
      donations: donations.map((d) => ({
        id: d.id,
        amount: parseFloat(d.amount.toString()),
        is_anonymous: d.isAnonymous,
        donor_name: d.isAnonymous
          ? 'Anonymous'
          : d.donor?.profile?.displayName || d.donor?.username || 'Unknown',
        created_at: d.createdAt,
      })),
      total,
      pages: Math.ceil(total / limit),
    };

    await redisClient.getClient().setEx(cacheKey, CACHE_TTL, JSON.stringify(result));
    return result;
  }

  /**
   * Get donor's full donation history (paginated)
   */
  static async getMyDonations(
    donorId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const skip = (page - 1) * limit;

    const [donations, total] = await Promise.all([
      prisma.donation.findMany({
        where: { donorId, status: 'success' },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          beg: {
            select: {
              id: true,
              description: true,
              status: true,
              amountRequested: true,
              amountRaised: true,
              category: { select: { name: true, icon: true } },
              user: {
                select: {
                  username: true,
                  profile: {
                    select: {
                      displayName: true,
                      isAnonymous: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
          },
          gratitudeMessage: {
            select: {
              id: true,
              messageType: true,
              content: true,
              donorReplyAllowed: true,
              donorReplied: true,
              donorReply: true,
              expiresAt: true,
            },
          },
        },
      }),
      prisma.donation.count({ where: { donorId, status: 'success' } }),
    ]);

    return {
      donations: donations.map((d) => ({
        id: d.id,
        amount: parseFloat(d.amount.toString()),
        is_anonymous: d.isAnonymous,
        payment_method: d.paymentMethod,
        created_at: d.createdAt,
        request: {
          id: d.beg.id,
          title: buildBegTitle(d.beg.category, d.beg.description),
          status: d.beg.status,
          category: d.beg.category,
          amount_requested: parseFloat(d.beg.amountRequested.toString()),
          amount_raised: parseFloat(d.beg.amountRaised.toString()),
          recipient_name: d.isAnonymous
            ? undefined
            : d.beg.user.profile?.displayName || d.beg.user.username,
          recipient_first_name: d.isAnonymous
            ? undefined
            : d.beg.user.profile?.firstName ?? undefined,
          recipient_last_name: d.isAnonymous
            ? undefined
            : d.beg.user.profile?.lastName ?? undefined,
          is_funded: d.beg.status === 'funded',
        },
        gratitude: d.gratitudeMessage
          ? {
              id: d.gratitudeMessage.id,
              content:
                d.gratitudeMessage.content ||
                GRATITUDE_MESSAGES[d.gratitudeMessage.messageType as 1 | 2],
              donor_reply_allowed: d.gratitudeMessage.donorReplyAllowed,
              donor_replied: d.gratitudeMessage.donorReplied,
              donor_reply: d.gratitudeMessage.donorReply,
              expires_at: d.gratitudeMessage.expiresAt,
            }
          : undefined,
      })),
      total,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get all successful donations for a specific beg (for update validation)
   */
  static async getDonationsByBegId(begId: string): Promise<any[]> {
    try {
      const donations = await prisma.donation.findMany({
        where: { begId, status: 'success' },
        select: {
          id: true,
          amount: true,
          createdAt: true,
          isAnonymous: true,
          donor: {
            select: {
              id: true,
              username: true,
              profile: { select: { displayName: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return donations.map((d) => ({
        id: d.id,
        amount: parseFloat(d.amount.toString()),
        createdAt: d.createdAt,
        donorName: d.isAnonymous
          ? 'Anonymous'
          : d.donor?.profile?.displayName || d.donor?.username || 'Unknown',
      }));
    } catch (error: any) {
      logger.error('Failed to get donations by beg ID', {
        error: error.message,
        begId,
      });
      return [];
    }
  }

  /**
   * Invalidate beg donations cache
   */
  static async invalidateBegDonationsCache(begId: string): Promise<void> {
    try {
      const keys = await redisClient
        .getClient()
        .keys(`${BEG_DONATIONS_CACHE_PREFIX}${begId}:*`);
      if (keys.length > 0) await redisClient.getClient().del(keys);
    } catch (error: any) {
      logger.error('Failed to invalidate beg donations cache', {
        error: error.message,
        begId,
      });
    }
  }
}
// ```

// **Only one thing changed** — Steps 10, 11 and 12 now use the queue:
// ```
// ❌ Before (direct):
// await TrustScoreService.invalidateTrustScoreCache(recipientId)
// await TrustScoreService.invalidateTrustScoreCache(donorId)
// await TrustScoreService.calculateTrustScore(recipientId)
// await TrustScoreService.calculateTrustScore(donorId)

// ✅ After (queue with direct fallback):
// trustScoreQueue.add('invalidate', ...) → trust-score.processor.ts handles it
// trustScoreQueue.add('recalculate', ...) → trust-score.processor.ts handles it
// ↓ if queue down → falls back to direct TrustScoreService calls
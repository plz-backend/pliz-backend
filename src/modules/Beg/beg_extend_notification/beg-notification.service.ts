import prisma from '../../../config/database';
import logger from '../../../config/logger';

const VALID_EXPIRY_HOURS = [24, 72, 168] as const;

export class BegNotificationService {

  /**
   * Get begs expiring within 1 hour for a user (used by frontend to show popup)
   */
  static async getExpiringBegs(userId: string) {
    const soon = new Date();
    soon.setHours(soon.getHours() + 1);

    const expiringBegs = await prisma.beg.findMany({
      where: {
        userId,
        status: 'active',
        approved: true,
        expiryHours: { in: [24, 72] }, // 168 = max, no popup needed
        expiresAt: { lte: soon, gt: new Date() },
      },
      select: {
        id: true,
        description: true,
        expiryHours: true,
        expiresAt: true,
        amountRequested: true,
        amountRaised: true,
      },
    });

    // For each expiring beg, compute what they can extend to
    return expiringBegs.map(beg => ({
      ...beg,
      amountRequested: Number(beg.amountRequested),
      amountRaised: Number(beg.amountRaised),
      availableExtensions: VALID_EXPIRY_HOURS
        .filter(h => h > beg.expiryHours)
        .map(h => ({
          hours: h,
          label: h === 24 ? '24 hours' : h === 72 ? '72 hours' : '7 days',
        })),
    }));
  }

  /**
   * Cron job — runs every hour
   * Finds ALL expiring begs and logs/sends notifications
   */
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
        const canExtendTo = VALID_EXPIRY_HOURS.filter(h => h > beg.expiryHours);

        // TODO: plug in your notification provider here
        // e.g. Firebase push notification, email, SMS
        logger.info('Expiry notification triggered', {
          begId: beg.id,
          userId: beg.userId,
          currentExpiryHours: beg.expiryHours,
          canExtendTo,
          expiresAt: beg.expiresAt,
        });
      }

      logger.info('Expiry notification cron completed', { count: expiringBegs.length });
    } catch (error: any) {
      logger.error('Failed to run expiry notification cron', { error: error.message });
    }
  }
}
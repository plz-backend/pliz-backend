import { Prisma } from '@prisma/client';
import prisma from '../config/database';
import logger from '../config/logger';

function weekAgo(from = new Date()): Date {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - 7);
  return d;
}

function isWeekAnchorStale(anchor: Date | null | undefined, now = new Date()): boolean {
  if (!anchor) return true;
  return anchor.getTime() < weekAgo(now).getTime();
}

type PeopleHelpedDb = Pick<Prisma.TransactionClient, 'donation' | 'userStats'>;

/**
 * Increment precomputed people-helped counters when a donation succeeds.
 * Run after the core donation transaction commits — avoids interactive tx timeouts.
 */
export async function applyDonorPeopleHelpedOnDonation(
  db: PeopleHelpedDb,
  donorId: string,
  recipientId: string,
  excludeDonationId: string
): Promise<void> {
  const priorToRecipient = await db.donation.count({
    where: {
      donorId,
      status: 'success',
      id: { not: excludeDonationId },
      beg: { userId: recipientId },
    },
  });

  const since = weekAgo();
  const priorThisWeekToRecipient = await db.donation.count({
    where: {
      donorId,
      status: 'success',
      id: { not: excludeDonationId },
      createdAt: { gte: since },
      beg: { userId: recipientId },
    },
  });

  const existing = await db.userStats.findUnique({
    where: { userId: donorId },
    select: {
      peopleHelpedThisWeek: true,
      peopleHelpedWeekAnchor: true,
    },
  });

  const now = new Date();
  const weeklyStale = isWeekAnchorStale(existing?.peopleHelpedWeekAnchor, now);
  const baseWeekly = weeklyStale ? 0 : (existing?.peopleHelpedThisWeek ?? 0);

  const update: Prisma.UserStatsUpdateInput = {};
  const createExtras: Partial<Prisma.UserStatsCreateInput> = {};

  if (priorToRecipient === 0) {
    update.peopleHelped = { increment: 1 };
    createExtras.peopleHelped = 1;
  }

  if (priorThisWeekToRecipient === 0) {
    update.peopleHelpedThisWeek = baseWeekly + 1;
    update.peopleHelpedWeekAnchor = now;
    createExtras.peopleHelpedThisWeek = 1;
    createExtras.peopleHelpedWeekAnchor = now;
  } else if (weeklyStale) {
    update.peopleHelpedThisWeek = 0;
    update.peopleHelpedWeekAnchor = now;
  }

  if (Object.keys(update).length === 0) {
    return;
  }

  await db.userStats.upsert({
    where: { userId: donorId },
    update,
    create: {
      userId: donorId,
      totalDonated: 0,
      totalReceived: 0,
      requestsCount: 0,
      abuseFlags: 0,
      peopleHelped: createExtras.peopleHelped ?? 0,
      peopleHelpedThisWeek: createExtras.peopleHelpedThisWeek ?? 0,
      peopleHelpedWeekAnchor: createExtras.peopleHelpedWeekAnchor ?? null,
    },
  });
}

/**
 * Returns fresh weekly count; lazily resets stored weekly stats when the anchor is stale.
 */
export async function resolvePeopleHelpedThisWeek(
  userId: string,
  stats: {
    peopleHelpedThisWeek: number;
    peopleHelpedWeekAnchor: Date | null;
  } | null
): Promise<number> {
  if (!stats || isWeekAnchorStale(stats.peopleHelpedWeekAnchor)) {
    const since = weekAgo();
    const weeklyRows = await prisma.donation.findMany({
      where: {
        donorId: userId,
        status: 'success',
        createdAt: { gte: since },
      },
      distinct: ['begId'],
      select: { beg: { select: { userId: true } } },
    });
    const count = new Set(weeklyRows.map((r) => r.beg.userId)).size;

    try {
      await prisma.userStats.upsert({
        where: { userId },
        update: {
          peopleHelpedThisWeek: count,
          peopleHelpedWeekAnchor: new Date(),
        },
        create: {
          userId,
          peopleHelpedThisWeek: count,
          peopleHelpedWeekAnchor: new Date(),
        },
      });
    } catch (error: unknown) {
      logger.warn('Failed to refresh weekly people-helped stats', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return count;
  }

  return stats.peopleHelpedThisWeek;
}

export function readPeopleHelpedFromStats(
  stats: {
    peopleHelped?: number;
    peopleHelpedThisWeek?: number;
  } | null | undefined
): { peopleHelped: number; peopleHelpedThisWeek: number } {
  return {
    peopleHelped: stats?.peopleHelped ?? 0,
    peopleHelpedThisWeek: stats?.peopleHelpedThisWeek ?? 0,
  };
}

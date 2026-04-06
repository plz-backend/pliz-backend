import { Queue } from 'bullmq';
import { bullMQConnection } from './bullmq-connection';
import { QUEUES, QUEUE_CONFIG } from './queue';
import logger from './logger';

const connection = bullMQConnection;

// ============================================
// CREATE QUEUES
// ============================================
export const donationQueue = new Queue(QUEUES.DONATIONS, {
  connection,
  defaultJobOptions: QUEUE_CONFIG.defaultJobOptions,
});

export const withdrawalQueue = new Queue(QUEUES.WITHDRAWALS, {
  connection,
  defaultJobOptions: QUEUE_CONFIG.defaultJobOptions,
});

export const notificationQueue = new Queue(QUEUES.NOTIFICATIONS, {
  connection,
  defaultJobOptions: {
    ...QUEUE_CONFIG.defaultJobOptions,
    attempts: 5,                    // Notifications get more retries
  },
});

export const emailQueue = new Queue(QUEUES.EMAILS, {
  connection,
  defaultJobOptions: {
    ...QUEUE_CONFIG.defaultJobOptions,
    attempts: 5,
  },
});

export const trustScoreQueue = new Queue(QUEUES.TRUST_SCORE, {
  connection,
  defaultJobOptions: QUEUE_CONFIG.defaultJobOptions,
});

export const begExpiryQueue = new Queue(QUEUES.BEG_EXPIRY, {
  connection,
  defaultJobOptions: QUEUE_CONFIG.defaultJobOptions,
});

// ============================================
// QUEUE HEALTH CHECK
// ============================================
export const getQueueHealth = async () => {
  const queues = [
    donationQueue,
    withdrawalQueue,
    notificationQueue,
    emailQueue,
    trustScoreQueue,
    begExpiryQueue,
  ];

  const health = await Promise.all(
    queues.map(async (q) => ({
      name: q.name,
      waiting: await q.getWaitingCount(),
      active: await q.getActiveCount(),
      completed: await q.getCompletedCount(),
      failed: await q.getFailedCount(),
      delayed: await q.getDelayedCount(),
    }))
  );

  return health;
};

logger.info('All queues initialized');
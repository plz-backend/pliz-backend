import { Queue, Worker, QueueEvents } from 'bullmq';
import { QUEUES, QUEUE_CONFIG } from './queue';
import logger from './logger';

// ============================================
// REDIS CONNECTION WITH RECONNECTION SETTINGS
// ============================================
const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,  // ← for production Redis (Upstash etc.)

  // Reconnection settings — prevents ECONNRESET from crashing workers
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 500, 5000); // Max 5s between retries
    logger.warn(`Redis reconnecting... attempt ${times}`, { delay });
    return delay;
  },
  maxRetriesPerRequest: null,              // ← Required by BullMQ
  enableReadyCheck: false,                 // ← Prevents connection issues
  reconnectOnError: (err: Error) => {
    logger.error('Redis connection error', { error: err.message });
    return true;                           // Always try to reconnect
  },
};

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
    attempts: 5,
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
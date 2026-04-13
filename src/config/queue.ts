export const QUEUES = {
  DONATIONS: 'donations',
  WITHDRAWALS: 'withdrawals',
  NOTIFICATIONS: 'notifications',
  EMAILS: 'emails',
  TRUST_SCORE: 'trust_score',
  BEG_EXPIRY: 'beg_expiry',
} as const;

export const QUEUE_CONFIG = {
  defaultJobOptions: {
    attempts: 3,                    // Retry 3 times if job fails
    backoff: {
      type: 'exponential' as const,
      delay: 2000,                  // Start with 2s, then 4s, then 8s
    },
    // OPTIMIZATION: remove jobs after completion to save Redis memory
    removeOnComplete: {
    age: 3600,      // remove completed jobs older than 1 hour
    count: 100,     // keep max 100 completed jobs
  },
    removeOnFail: {
    age: 24 * 3600, // remove failed jobs older than 24 hours
    count: 200,     // keep max 200 failed jobs
  },
  },
};
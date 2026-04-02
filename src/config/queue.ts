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
    removeOnComplete: 100,          // Keep last 100 completed jobs
    removeOnFail: 500,              // Keep last 500 failed jobs for debugging
  },
};
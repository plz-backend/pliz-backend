import { Worker, Job } from 'bullmq';
import { QUEUES } from '../../config/queue';
import { TrustScoreService } from '../../services/trust_score.service';
import { ITrustScoreJob } from '../job.types';
import logger from '../../config/logger';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

export const trustScoreWorker = new Worker<ITrustScoreJob>(
  QUEUES.TRUST_SCORE,
  async (job: Job<ITrustScoreJob>) => {
    logger.info('Processing trust score job', {
      jobId: job.id,
      userId: job.data.userId,
      action: job.data.action,
    });

    if (job.data.action === 'invalidate') {
      await TrustScoreService.invalidateTrustScoreCache(job.data.userId);
    } else {
      await TrustScoreService.calculateTrustScore(job.data.userId);
    }

    logger.info('Trust score job completed', { jobId: job.id });
  },
  {
    connection,
    concurrency: 10,
  }
);

trustScoreWorker.on('failed', (job, error) => {
  logger.error('Trust score job failed', {
    jobId: job?.id,
    userId: job?.data?.userId,
    error: error.message,
  });
});

logger.info('Trust score worker started');
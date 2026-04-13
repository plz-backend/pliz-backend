import { Worker, Job } from 'bullmq';
import { bullMQConnection } from '../../config/bullmq-connection';
import { QUEUES } from '../../config/queue';
import { getBullMQConnection } from '../../config/bullmq-connection';  // ← shared
import { TrustScoreService } from '../../services/trust_score.service';
import { ITrustScoreJob } from '../job.types';
import logger from '../../config/logger';

const connection = getBullMQConnection();  // use shared connection

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
    stalledInterval: 300000,    // OPTIMIZATION: check stalled every 5min not 5sec
  }
);

trustScoreWorker.on('completed', (job) => {
  logger.info('Trust score job completed', {
    jobId: job.id,
    userId: job.data.userId,
    action: job.data.action,
  });
});

trustScoreWorker.on('failed', (job, error) => {
  logger.error('Trust score job failed', {
    jobId: job?.id,
    userId: job?.data?.userId,
    action: job?.data?.action,
    error: error.message,
  });
});

trustScoreWorker.on('error', (error) => {
  logger.error('Trust score worker error', { error: error.message });
});

trustScoreWorker.on('stalled', (jobId) => {
  logger.warn('Trust score job stalled', { jobId });
});

logger.info('Trust score worker started');
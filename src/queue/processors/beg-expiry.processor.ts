import { Worker, Job } from 'bullmq';
import { bullMQConnection } from '../../config/bullmq-connection';
import { QUEUES } from '../../config/queue';
import { BegService } from '../../modules/Beg/services/beg.service';
import { BegNotificationService } from '../../modules/Beg/beg_extend_notification/beg-notification.service';
import { IBegExpiryJob } from '../job.types';
import logger from '../../config/logger';

const connection = bullMQConnection;

export const begExpiryWorker = new Worker<IBegExpiryJob>(
  QUEUES.BEG_EXPIRY,
  async (job: Job<IBegExpiryJob>) => {
    logger.info('Processing beg expiry job', { jobId: job.id });

    // Expire old begs
    const expiredCount = await BegService.expireOldBegs();

    // Notify begs expiring within 1 hour
    await BegNotificationService.notifyExpiringBegs();

    logger.info('Beg expiry job completed', { jobId: job.id, expiredCount });
  },
  {
    connection,
    concurrency: 1,
  }
);

begExpiryWorker.on('completed', (job) => {
  logger.info('Beg expiry job completed', { jobId: job.id });
});

begExpiryWorker.on('failed', (job, error) => {
  logger.error('Beg expiry job failed', {
    jobId: job?.id,
    error: error.message,
  });
});

// ← THIS IS THE IMPORTANT ONE — prevents ECONNRESET from crashing the worker
begExpiryWorker.on('error', (error) => {
  logger.error('Beg expiry worker error', { error: error.message });
});

logger.info('Beg expiry worker started');
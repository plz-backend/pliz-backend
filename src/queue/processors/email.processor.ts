import { Worker, Job } from 'bullmq';
import { QUEUES } from '../../config/queue';
import { WithdrawalEmailService } from '../../modules/Withdrawal/services/withdrawal_email.service';
import { IEmailJob } from '../job.types';
import logger from '../../config/logger';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  retryStrategy: (times: number) => Math.min(times * 500, 5000),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

export const emailWorker = new Worker<IEmailJob>(
  QUEUES.EMAILS,
  async (job: Job<IEmailJob>) => {
    logger.info('Processing email job', {
      jobId: job.id,
      type: job.data.type,
      to: job.data.to,
    });

    switch (job.data.type) {
      case 'withdrawal_success':
        await WithdrawalEmailService.sendSuccessEmail(job.data.to, job.data.data as any);
        break;
      case 'withdrawal_failed':
        await WithdrawalEmailService.sendFailureEmail(job.data.to, job.data.data as any);
        break;
      case 'withdrawal_pending':
        await WithdrawalEmailService.sendPendingEmail(job.data.to, job.data.data as any);
        break;
      default:
        logger.warn('Unknown email job type', { type: job.data.type });
    }

    logger.info('Email job completed', { jobId: job.id, type: job.data.type });
  },
  {
    connection,
    concurrency: 10,
  }
);

emailWorker.on('completed', (job) => {
  logger.info('Email job completed', { jobId: job.id });
});

emailWorker.on('failed', (job, error) => {
  logger.error('Email job failed', {
    jobId: job?.id,
    type: job?.data?.type,
    to: job?.data?.to,
    error: error.message,
  });
});

emailWorker.on('error', (error) => {
  logger.error('Email worker error', { error: error.message });
});

// ← stalled means user may not have received their email notification
emailWorker.on('stalled', (jobId) => {
  logger.warn('Email job stalled', { jobId });
});

logger.info('Email worker started');
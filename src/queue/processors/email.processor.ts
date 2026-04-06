import { Worker, Job } from 'bullmq';
import { bullMQConnection } from '../../config/bullmq-connection';
import { QUEUES } from '../../config/queue';
import { WithdrawalEmailService } from '../../modules/Withdrawal/services/withdrawal_email.service';
import { IEmailJob } from '../job.types';
import logger from '../../config/logger';

const connection = bullMQConnection;

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
    concurrency: 10,  // Emails can be sent in parallel
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

logger.info('Email worker started');
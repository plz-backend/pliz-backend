import { Worker, Job } from 'bullmq';
import { QUEUES } from '../../config/queue';
import { WithdrawalService } from '../../modules/Withdrawal/services/withdrawal.service';
import { IWithdrawalJob } from '../job.types';
import logger from '../../config/logger';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

export const withdrawalWorker = new Worker<IWithdrawalJob>(
  QUEUES.WITHDRAWALS,
  async (job: Job<IWithdrawalJob>) => {
    logger.info('Processing withdrawal job', {
      jobId: job.id,
      withdrawalId: job.data.withdrawalId,
      attempt: job.attemptsMade + 1,
    });

    await WithdrawalService.processWithdrawal(
      job.data.withdrawalId,
      job.data.autoProcessed
    );

    logger.info('Withdrawal job completed', {
      jobId: job.id,
      withdrawalId: job.data.withdrawalId,
    });
  },
  {
    connection,
    concurrency: 2,   // Only 2 withdrawals at a time — Paystack rate limits
  }
);

withdrawalWorker.on('completed', (job) => {
  logger.info('Withdrawal job completed', { jobId: job.id });
});

withdrawalWorker.on('failed', (job, error) => {
  logger.error('Withdrawal job failed', {
    jobId: job?.id,
    withdrawalId: job?.data?.withdrawalId,
    error: error.message,
    attempts: job?.attemptsMade,
  });
});

withdrawalWorker.on('error', (error) => {
  logger.error('Withdrawal worker error', { error: error.message });
});

logger.info('Withdrawal worker started');
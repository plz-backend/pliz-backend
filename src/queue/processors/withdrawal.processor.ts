import { Worker, Job } from 'bullmq';
import { bullMQConnection } from '../../config/bullmq-connection';
import { QUEUES } from '../../config/queue';
import { getBullMQConnection } from '../../config/bullmq-connection';  // ← shared connection
import { WithdrawalService } from '../../modules/Withdrawal/services/withdrawal.service';
import { IWithdrawalJob } from '../job.types';
import logger from '../../config/logger';

const connection = getBullMQConnection();  // use shared connection

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
    stalledInterval: 300000,    // ← OPTIMIZATION: check stalled every 5min not 5sec
  }
);

withdrawalWorker.on('completed', (job) => {
  logger.info('Withdrawal job completed', {
    jobId: job.id,
    withdrawalId: job.data.withdrawalId,
  });
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

withdrawalWorker.on('stalled', (jobId) => {
  logger.error('Withdrawal job stalled — user may not have received their money', {
    jobId,
  });
});

logger.info('Withdrawal worker started');
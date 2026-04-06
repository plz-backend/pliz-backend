import { Worker, Job } from 'bullmq';
import { bullMQConnection } from '../../config/bullmq-connection';
import { QUEUES } from '../../config/queue';
import { DonationService } from '../../modules/Donor/services/donation.service';
import { IDonationJob } from '../job.types';
import logger from '../../config/logger';

const connection = bullMQConnection;

export const donationWorker = new Worker<IDonationJob>(
  QUEUES.DONATIONS,
  async (job: Job<IDonationJob>) => {
    logger.info('Processing donation job', {
      jobId: job.id,
      reference: job.data.paymentReference,
      attempt: job.attemptsMade + 1,
    });

    await DonationService.processDonation(job.data);

    logger.info('Donation job completed', {
      jobId: job.id,
      reference: job.data.paymentReference,
    });
  },
  {
    connection,
    concurrency: 5,
  }
);

// ============================================
// WORKER EVENTS
// ============================================
donationWorker.on('completed', (job) => {
  logger.info('Donation job completed', { jobId: job.id });
});

donationWorker.on('failed', (job, error) => {
  logger.error('Donation job failed', {
    jobId: job?.id,
    reference: job?.data?.paymentReference,
    error: error.message,
    attempts: job?.attemptsMade,
  });
});

donationWorker.on('error', (error) => {
  logger.error('Donation worker error', { error: error.message });
});

// ← IMPORTANT for money app — stalled means job was picked up but never finished
// Could mean user paid but donation not recorded
donationWorker.on('stalled', (jobId) => {
  logger.error('Donation job stalled — user may have paid but donation not recorded', {
    jobId,
  });
});

logger.info('Donation worker started');
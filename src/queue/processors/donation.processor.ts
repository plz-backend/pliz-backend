import { Worker, Job } from 'bullmq';
import { QUEUES } from '../../config/queue';
import { DonationService } from '../../modules/Donor/services/donation.service';
import { IDonationJob } from '../job.types';
import logger from '../../config/logger';

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

export const donationWorker = new Worker<IDonationJob>(
  QUEUES.DONATIONS,
  async (job: Job<IDonationJob>) => {
    logger.info(`Processing donation job`, {
      jobId: job.id,
      reference: job.data.paymentReference,
      attempt: job.attemptsMade + 1,
    });

    await DonationService.processDonation(job.data);

    logger.info(`Donation job completed`, {
      jobId: job.id,
      reference: job.data.paymentReference,
    });
  },
  {
    connection,
    concurrency: 5,   // Process 5 donations at the same time
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

logger.info('Donation worker started');
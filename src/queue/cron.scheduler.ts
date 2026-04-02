import { donationQueue, withdrawalQueue, begExpiryQueue } from '../config/queue-manager';
import logger from '../config/logger';

export const startScheduler = async () => {
  // Run beg expiry check every hour
  await begExpiryQueue.add(
    'check-expiry',
    {},
    {
      repeat: { pattern: '0 * * * *' },  // Every hour
      jobId: 'beg-expiry-cron',          // Unique ID prevents duplicates
    }
  );

  logger.info('Queue scheduler started — beg expiry runs every hour');
};
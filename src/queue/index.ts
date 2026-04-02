// Import all workers to start them
import './processors/donation.processor';
import './processors/withdrawal.processor';
import './processors/email.processor';
import './processors/trust-score.processor';
import './processors/beg-expiry.processor';
import { startScheduler } from './cron.scheduler';
import logger from '../config/logger';

export const initializeQueues = async () => {
  await startScheduler();
  logger.info('All queue workers and schedulers initialized');
};
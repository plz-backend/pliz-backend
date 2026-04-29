import dotenv from 'dotenv'

dotenv.config();

import { connectDB } from '../src/config/database';
import redisClient from '../src/config/redis';
import { EmailService } from '../src/modules/auth/services/emailService';
import logger from '../src/config/logger';

import {donationWorker} from '../src/queue/processors/donation.processor';
import {withdrawalWorker} from '../src/queue/processors/withdrawal.processor';
import {emailWorker} from '../src/queue/processors/email.processor';
import {trustScoreWorker,} from '../src/queue/processors/trust-score.processor';
import {begExpiryWorker} from '../src/queue/processors/beg-expiry.processor';

import {startScheduler} from '../src/queue/cron.scheduler';



const startWorkers = async (): Promise<void> => {
  try {
    // 1. Connect to PostgreSQL
    await connectDB();
    logger.info('PostgreSQL connected');

    // 2. Connect to Redis
    await redisClient.connect();
    logger.info('Redis connected');

    // 3. Initialize email service
    EmailService.initialize();
    logger.info('Email service initialized');

    // 4. Start scheduler (beg expiry cron)
    await startScheduler();
    logger.info('Scheduler started');

    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🚀 PLZ QUEUE WORKERS — Running                               ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
PostgreSQL connected
Redis connected
Email service initialized
Scheduler started
Workers running:
   - Donation worker     (concurrency: 5)
   - Withdrawal worker   (concurrency: 2)
   - Email worker        (concurrency: 10)
   - Trust score worker  (concurrency: 10)
   - Beg expiry worker   (concurrency: 1)

Environment: ${process.env.NODE_ENV || 'development'}
    `);

    logger.info('All queue workers started successfully');
  } catch (error) {
    logger.error('Failed to start workers', { error });
    process.exit(1);
  }
};

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received, shutting down workers gracefully`);

  try {
    await Promise.all([
      donationWorker.close(),
      withdrawalWorker.close(),
      emailWorker.close(),
      trustScoreWorker.close(),
      begExpiryWorker.close(),
    ]);
    logger.info('All workers closed');
  } catch (error: any) {
    logger.warn('Error closing workers', { error: error.message });
  }

  await redisClient.disconnect();
  logger.info('Graceful shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startWorkers();
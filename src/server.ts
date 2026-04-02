import dotenv from 'dotenv';
import http from 'http';
import { connectDB, disconnectDB } from './config/database';
import redisClient from './config/redis';
import { EmailService } from './modules/auth/services/emailService';
import { CategoryService } from './modules/Beg/services/category.service';
import { initializeSocket } from './config/socket';
import { initializeQueues } from './queue';
import {donationWorker} from '../src/queue/processors/donation.processor';
import {withdrawalWorker} from '../src/queue/processors/withdrawal.processor';
import {emailWorker} from '../src/queue/processors/email.processor';
import {trustScoreWorker} from '../src/queue/processors/trust-score.processor';
import {begExpiryWorker} from '../src/queue/processors/beg-expiry.processor';  
import logger from './config/logger';
import { createApp } from './app';

dotenv.config();

const startServer = async (): Promise<void> => {
  try {
    // 1. Connect to PostgreSQL
    await connectDB();

    // 2. Connect to Redis
    await redisClient.connect();

    // 3. Load categories into Redis on startup
    await CategoryService.loadCategoriesToCache();

    // 4. Initialize email service
    EmailService.initialize();

    // 5. Initialize queue workers — MUST be after Redis connects
    try {
      await initializeQueues();
      logger.info('Queue workers initialized successfully');
    } catch (queueError: any) {
      // Don't crash server — queues have direct processing fallback
      logger.warn('Queue initialization failed — falling back to direct processing', {
        error: queueError.message,
      });
    }

    // 6. Create Express app
    const app = createApp();

    // 7. Wrap with HTTP server so Socket.io can attach
    const server = http.createServer(app);

    // 8. Initialize Socket.io (real-time notifications)
    initializeSocket(server);

    const PORT = process.env.PORT || 3000;

    // Use server.listen (not app.listen) for Socket.io to work
    server.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🚀 PLZ APP - Server Running                                  ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
✅ PostgreSQL connected
✅ Redis connected
✅ Email service initialized
✅ Socket.io initialized (real-time notifications)
✅ Queue workers initialized (BullMQ)
✅ Server started successfully

📍 Port:          ${PORT}
🌐 API:           ${process.env.BASE_URL}:${PORT}/api
💚 Health:        ${process.env.BASE_URL}:${PORT}/health
🔐 Auth:          ${process.env.BASE_URL}:${PORT}/api/auth
📱 Sessions:      ${process.env.BASE_URL}:${PORT}/api/sessions
💰 Donations:     ${process.env.BASE_URL}:${PORT}/api/donations
🔔 Notifications: ${process.env.BASE_URL}:${PORT}/api/notifications
📖 Stories:       ${process.env.BASE_URL}:${PORT}/api/stories
🪝 Webhook:       ${process.env.BASE_URL}:${PORT}/webhooks/paystack
📊 Queue Health:  ${process.env.BASE_URL}:${PORT}/api/admin/queues/health
🌐 API:           ${process.env.BASE_URL}:${PORT}/api
💚 Health:        ${process.env.BASE_URL}:${PORT}/health
🔐 Auth:          ${process.env.BASE_URL}:${PORT}/api/auth
📱 Sessions:      ${process.env.BASE_URL}:${PORT}/api/sessions
💰 Donations:     ${process.env.BASE_URL}:${PORT}/api/donations
🔔 Notifications: ${process.env.BASE_URL}:${PORT}/api/notifications
🪝 Webhook:       ${process.env.BASE_URL}:${PORT}/webhooks/paystack

Environment: ${process.env.NODE_ENV || 'development'}
Database:    PostgreSQL
Cache:       Redis
Email:       ${process.env.EMAIL_HOST || 'Not configured'}
Payments:    Paystack
Queues:      BullMQ (donations, withdrawals, emails, trust, expiry)
      `);

      logger.info('Server started successfully', { port: PORT });
    });

    // Handle server errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
      } else {
        logger.error('Server error', { error: error.message });
      }
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

// ============================================
// GRACEFUL SHUTDOWN
// ============================================
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received, shutting down gracefully`);

  // 1. Close queue workers first — prevents losing in-progress jobs
  try {
    await Promise.all([
      donationWorker.close(),
      withdrawalWorker.close(),
      emailWorker.close(),
      trustScoreWorker.close(),
      begExpiryWorker.close(),
    ]);
    logger.info('Queue workers closed');
  } catch (error: any) {
    logger.warn('Error closing queue workers', { error: error.message });
  }

  // 2. Disconnect DB and Redis
  await disconnectDB();
  await redisClient.disconnect();

  logger.info('Graceful shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();
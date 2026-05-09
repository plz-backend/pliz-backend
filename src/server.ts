import 'dotenv/config';
import http from 'http';
import { connectDB, disconnectDB } from './config/database';
import redisClient from './config/redis';
import { EmailService } from './modules/auth/services/emailService';
import { CategoryService } from './modules/Beg/services/category.service';
import { initializeSocket } from './config/socket';
import { EmojiService } from './modules/Reactions/services/emoji.service';
import logger from './config/logger';
import { createApp } from './app';
import { GenericEmailService } from './services/email.service';
import { LocationService } from './modules/Location/services/location.service';
import { startBegMaintenanceCron } from './modules/Beg/beg_extend_notification/cron';





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

    // 5. Initialize generic email service     ← add here
    GenericEmailService.initialize();

    // 6. Preload emojis into Redis cache
    try {
      await EmojiService.getAllEmojis();
      logger.info('✅ Emojis preloaded into cache');
    } catch (error: any) {
      logger.warn('⚠️ Emoji preload failed — will load on first request', {
        error: error.message,
      });
    }

    // 7. Create Express app
    const app = createApp();

    // 8. Wrap with HTTP server so Socket.io can attach
    const server = http.createServer(app);

    // 9. Initialize Socket.io (real-time notifications)
    initializeSocket(server);

    // 10. Preload location data into cache
    try {
      await LocationService.getAllLocationData();
      logger.info('✅ Location data preloaded into cache');
    } catch (error: any) {
      logger.warn('⚠️ Location data preload failed — will load on first request', {
        error: error.message,
      });
    }

    if (process.env.SCHEDULER_ENABLED !== 'false') {
      startBegMaintenanceCron();
    } else {
      logger.info('API scheduler disabled by SCHEDULER_ENABLED=false');
    }

    const PORT = process.env.PORT || 3000;

    server.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🚀 PLZ APP - API Server Running                              ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
✅ PostgreSQL connected
✅ Redis connected
✅ Email service initialized
✅ Socket.io initialized (real-time notifications)
✅ Emojis preloaded into cache
✅ API Server started successfully

📍 Port:          ${PORT}
🌐 API:           http://localhost:${PORT}/api
💚 Health:        http://localhost:${PORT}/health
🔐 Auth:          http://localhost:${PORT}/api/auth
📱 Sessions:      http://localhost:${PORT}/api/sessions
💰 Donations:     http://localhost:${PORT}/api/donations
🔔 Notifications: http://localhost:${PORT}/api/notifications
📖 Stories:       http://localhost:${PORT}/api/stories
😊 Reactions:     http://localhost:${PORT}/api/reactions
🎫 Support:       http://localhost:${PORT}/api/support
🤖 AI Chat:       http://localhost:${PORT}/api/support/chat
🖼️  Profile Pic:  http://localhost:${PORT}/api/profile-picture
🪝 Webhook:       http://localhost:${PORT}/webhooks/paystack
📍 Location:      http://localhost:${PORT}/api/location

Environment: ${process.env.NODE_ENV || 'development'}
Database:    PostgreSQL
Cache:       Redis
Email:       ${process.env.EMAIL_HOST || 'Not configured'}
Payments:    Paystack
Scheduler:    node-cron in API process
      `);

      logger.info('API Server started successfully', { port: PORT });
    });

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
// Background queue workers were removed; scheduled maintenance runs via node-cron.
// ============================================
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received, shutting down API server gracefully`);

  await disconnectDB();
  await redisClient.disconnect();

  logger.info('API server shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer();

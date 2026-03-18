import dotenv from 'dotenv';
import http from 'http';
import { connectDB, disconnectDB } from './config/database';
import redisClient from './config/redis';
import { EmailService } from './modules/auth/services/emailService';
import { CategoryService } from './modules/Beg/services/category.service';
import { initializeSocket } from './config/socket';
import logger from './config/logger';
import { createApp } from './app';

// Load environment variables
dotenv.config();

const startServer = async (): Promise<void> => {
  try {
    // Connect to PostgreSQL
    await connectDB();

    // Connect to Redis
    await redisClient.connect();

    // Load categories into Redis on startup
    await CategoryService.loadCategoriesToCache();

    // Initialize email service
    EmailService.initialize();

    // Create Express app
    const app = createApp();

    // Wrap with HTTP server so Socket.io can attach
    const server = http.createServer(app);

    // Initialize Socket.io (real-time notifications)
    initializeSocket(server);

    const PORT = process.env.PORT || 3000;

    // Use server.listen (not app.listen) for Socket.io to work
    server.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   🚀 PLIZ APP - Server Running                                 ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
✅ PostgreSQL connected
✅ Redis connected
✅ Email service initialized
✅ Socket.io initialized (real-time notifications)
✅ Server started successfully

📍 Port:          ${PORT}
🌐 API:           http://localhost:${PORT}/api
💚 Health:        http://localhost:${PORT}/health
🔐 Auth:          http://localhost:${PORT}/api/auth
📱 Sessions:      http://localhost:${PORT}/api/sessions
💰 Donations:     http://localhost:${PORT}/api/donations
🔔 Notifications: http://localhost:${PORT}/api/notifications
🪝 Webhook:       http://localhost:${PORT}/webhooks/paystack

Environment: ${process.env.NODE_ENV || 'development'}
Database:    PostgreSQL
Cache:       Redis
Email:       ${process.env.EMAIL_HOST || 'Not configured'}
Payments:    Paystack
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

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await disconnectDB();
  await redisClient.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await disconnectDB();
  await redisClient.disconnect();
  process.exit(0);
});

startServer();
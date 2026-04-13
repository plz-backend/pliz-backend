import IORedis from 'ioredis';
import logger from './logger';

// ============================================
// SHARED BULLMQ CONNECTION
// One connection shared by ALL queues and workers
// Instead of each creating its own — saves Redis commands
// ============================================
let sharedConnection: IORedis | null = null;

export const getBullMQConnection = (): IORedis => {
  if (!sharedConnection) {
    sharedConnection = new IORedis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy: (times: number) => Math.min(times * 500, 5000),
    });

    sharedConnection.on('error', (error) => {
      logger.error('BullMQ Redis connection error', { error: error.message });
    });

    sharedConnection.on('connect', () => {
      logger.info('BullMQ Redis connected');
    });
  }

  return sharedConnection;
};

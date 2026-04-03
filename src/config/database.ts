import { PrismaClient } from '@prisma/client';
import logger from './logger';

const prismaClientSingleton = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = prisma;
}

export const connectDB = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('✅ PostgreSQL connected successfully');
  } 
  // catch (error) {
  //   logger.error('❌ PostgreSQL connection failed', { error });
  //   process.exit(1);
  // }
  catch (error: unknown) {
    const payload: Record<string, unknown> = {
      message: error instanceof Error ? error.message : String(error),
    };
    if (error instanceof Error) {
      payload.name = error.name;
      payload.stack = error.stack;
    }
    if (typeof error === 'object' && error !== null) {
      const o = error as Record<string, unknown>;
      if ('code' in o) payload.code = o.code;
      if ('prisma' in o) payload.prisma = o.prisma;
    }
    logger.error('❌ PostgreSQL connection failed', payload);
    process.exit(1);
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    logger.info('PostgreSQL disconnected successfully');
  } catch (error) {
    logger.error('PostgreSQL disconnection failed', { error });
  }
};

export default prisma;

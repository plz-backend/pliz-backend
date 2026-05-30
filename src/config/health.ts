import prisma from '../config/database';
import redisClient from '../config/redis';
import logger from '../config/logger';
import { getAppVersion, getGitSha } from './version';

export type HealthCheckResult = {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  git_sha?: string;
  uptime: number;
  timestamp: string;
  checks: {
    database: 'ok' | 'error';
    redis: 'ok' | 'error';
  };
};

export async function runHealthChecks(): Promise<HealthCheckResult> {
  const checks: HealthCheckResult['checks'] = {
    database: 'error',
    redis: 'error',
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (error: any) {
    logger.error('Health check: database failed', { error: error.message });
  }

  try {
    if (redisClient.isReady()) {
      const pong = await redisClient.getClient().ping();
      checks.redis = pong === 'PONG' ? 'ok' : 'error';
    }
  } catch (error: any) {
    logger.error('Health check: redis failed', { error: error.message });
  }

  const allOk = checks.database === 'ok' && checks.redis === 'ok';
  const anyOk = checks.database === 'ok' || checks.redis === 'ok';

  return {
    status: allOk ? 'healthy' : anyOk ? 'degraded' : 'unhealthy',
    version: getAppVersion(),
    git_sha: getGitSha(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks,
  };
}

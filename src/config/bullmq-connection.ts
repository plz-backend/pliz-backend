import type { RedisOptions } from 'ioredis';

/**
 * BullMQ uses ioredis; blocking commands require this.
 * @see https://docs.bullmq.io/guide/connections
 */
const IOREDIS_BULLMQ: Partial<RedisOptions> = {
  maxRetriesPerRequest: null,
};

/**
 * Build ioredis options for BullMQ Queues/Workers.
 * Prefer `REDIS_URL` (same as `redis` package / Prisma cache) so host/port/TLS stay in sync.
 * Supports `redis://` and `rediss://` (TLS).
 */
function parseRedisUrl(urlString: string): RedisOptions {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('Invalid REDIS_URL');
  }

  const useTls = url.protocol === 'rediss:';
  const port = url.port ? parseInt(url.port, 10) : 6379;
  const password =
    url.password !== '' ? decodeURIComponent(url.password) : undefined;
  const username =
    url.username && url.username !== 'default'
      ? decodeURIComponent(url.username)
      : undefined;

  let db = 0;
  if (url.pathname && url.pathname !== '/') {
    const n = parseInt(url.pathname.replace(/\//g, ''), 10);
    if (!Number.isNaN(n)) db = n;
  }

  return {
    ...IOREDIS_BULLMQ,
    host: url.hostname,
    port,
    password,
    ...(username ? { username } : {}),
    db,
    ...(useTls ? { tls: {} } : {}),
  };
}

export function getBullMQConnection(): RedisOptions {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    return parseRedisUrl(redisUrl);
  }

  return {
    ...IOREDIS_BULLMQ,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  };
}

/** Resolved once when this module loads (after dotenv). */
export const bullMQConnection = getBullMQConnection();

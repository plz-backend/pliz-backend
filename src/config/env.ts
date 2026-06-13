import { z } from 'zod';
import logger from './logger';

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.string().optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  REFRESH_TOKEN_PEPPER: z.string().optional(),
  DATA_ENCRYPTION_KEY: z.string().optional(),
  FLW_SECRET_KEY: z.string().min(1, 'FLW_SECRET_KEY is required'),
  FLW_WEBHOOK_HASH: z.string().min(1, 'FLW_WEBHOOK_HASH is required'),
  BASE_URL: z.string().url().optional(),
  FRONTEND_URL: z.string().url().optional(),
  ALLOWED_ORIGINS: z.string().optional(),
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  COOKIE_DOMAIN: z.string().optional(),
  SCHEDULER_ENABLED: z.enum(['true', 'false']).optional(),
  SCHEDULER_SECRET: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().optional(),
  SUPABASE_KYC_BUCKET: z.string().optional(),
  PREMBLY_API_KEY: z.string().optional(),
  PREMBLY_APP_ID: z.string().optional(),
  SENDCHAMP_API_KEY: z.string().optional(),
  PREMBLY_SKIP_VERIFICATION: z.enum(['true', 'false']).optional(),
});

const productionSchema = baseSchema.superRefine((data, ctx) => {
  if (!data.BASE_URL) {
    ctx.addIssue({ code: 'custom', message: 'BASE_URL is required in production', path: ['BASE_URL'] });
  }
  if (!data.FRONTEND_URL) {
    ctx.addIssue({
      code: 'custom',
      message: 'FRONTEND_URL is required in production',
      path: ['FRONTEND_URL'],
    });
  }
  if (!data.ALLOWED_ORIGINS?.trim()) {
    ctx.addIssue({
      code: 'custom',
      message: 'ALLOWED_ORIGINS must list trusted web origins in production',
      path: ['ALLOWED_ORIGINS'],
    });
  }
  if (data.COOKIE_SECURE !== 'true') {
    ctx.addIssue({
      code: 'custom',
      message: 'COOKIE_SECURE must be true in production',
      path: ['COOKIE_SECURE'],
    });
  }
  if (!data.COOKIE_DOMAIN?.trim()) {
    ctx.addIssue({
      code: 'custom',
      message:
        'COOKIE_DOMAIN is required in production (e.g. .plz.ng) for cross-subdomain web auth cookies',
      path: ['COOKIE_DOMAIN'],
    });
  }
  if (!data.REFRESH_TOKEN_PEPPER || data.REFRESH_TOKEN_PEPPER.length < 32) {
    ctx.addIssue({
      code: 'custom',
      message: 'REFRESH_TOKEN_PEPPER must be at least 32 characters in production',
      path: ['REFRESH_TOKEN_PEPPER'],
    });
  }
  if (!data.DATA_ENCRYPTION_KEY || data.DATA_ENCRYPTION_KEY.length < 32) {
    ctx.addIssue({
      code: 'custom',
      message: 'DATA_ENCRYPTION_KEY must be at least 32 characters in production',
      path: ['DATA_ENCRYPTION_KEY'],
    });
  }
  if (!data.SUPABASE_URL) {
    ctx.addIssue({
      code: 'custom',
      message: 'SUPABASE_URL is required in production',
      path: ['SUPABASE_URL'],
    });
  }
  if (!data.SUPABASE_SERVICE_KEY) {
    ctx.addIssue({
      code: 'custom',
      message: 'SUPABASE_SERVICE_KEY is required in production',
      path: ['SUPABASE_SERVICE_KEY'],
    });
  }
  if (!data.SUPABASE_KYC_BUCKET?.trim()) {
    ctx.addIssue({
      code: 'custom',
      message: 'SUPABASE_KYC_BUCKET is required in production',
      path: ['SUPABASE_KYC_BUCKET'],
    });
  }
  if (!data.SCHEDULER_SECRET || data.SCHEDULER_SECRET.length < 16) {
    ctx.addIssue({
      code: 'custom',
      message: 'SCHEDULER_SECRET is required for Cloud Scheduler in production',
      path: ['SCHEDULER_SECRET'],
    });
  }
});

export type AppEnv = z.infer<typeof baseSchema>;

let cachedEnv: AppEnv | null = null;

export function validateEnv(): AppEnv {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const schema = nodeEnv === 'production' ? productionSchema : baseSchema;

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    logger.error('Environment validation failed', { details });
    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  if (nodeEnv === 'production') {
    if (parsed.data.JWT_SECRET === parsed.data.JWT_REFRESH_SECRET) {
      throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different in production');
    }
    if (parsed.data.PREMBLY_SKIP_VERIFICATION === 'true') {
      throw new Error('PREMBLY_SKIP_VERIFICATION must not be true in production');
    }
  }

  cachedEnv = parsed.data;
  return parsed.data;
}

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    return validateEnv();
  }
  return cachedEnv;
}

export function isProduction(): boolean {
  return (process.env.NODE_ENV || 'development') === 'production';
}

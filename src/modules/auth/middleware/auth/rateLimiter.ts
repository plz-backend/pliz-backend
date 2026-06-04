import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { IApiResponse } from '../../types/user.interface';
import redisClient from '../../../../config/redis';

/**
 * Custom rate limit handler
 */
const rateLimitHandler = (req: Request, res: Response): void => {
  const response: IApiResponse = {
    success: false,
    message: 'Too many requests. Please try again later.',
  };
  res.status(429).json(response);
};

class RedisRateLimitStore {
  windowMs = 900000;
  localKeys = false;

  constructor(private readonly prefix: string) {}

  init(options: { windowMs: number }): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const client = redisClient.getClient();
    const redisKey = `rate_limit:${this.prefix}:${key}`;
    const totalHits = await client.incr(redisKey);
    if (totalHits === 1) {
      await client.pExpire(redisKey, this.windowMs);
    }
    const ttl = await client.pTTL(redisKey);
    return {
      totalHits,
      resetTime: new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs)),
    };
  }

  async decrement(key: string): Promise<void> {
    const client = redisClient.getClient();
    const redisKey = `rate_limit:${this.prefix}:${key}`;
    const value = await client.decr(redisKey);
    if (value <= 0) await client.del(redisKey);
  }

  async resetKey(key: string): Promise<void> {
    await redisClient.getClient().del(`rate_limit:${this.prefix}:${key}`);
  }
}

/**
 * Auth Rate Limiter
 * For sensitive endpoints like login, register, password reset
 * Limit: 5 requests per 15 minutes
 */
export const authLimiter = rateLimit({
  store: new RedisRateLimitStore('auth') as any,
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '5'), // 5 requests
  message: {
    success: false,
    message: 'Too many attempts. Please try again in 15 minutes.',
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false, // Disable X-RateLimit-* headers
  handler: rateLimitHandler,
});

/**
 * General Rate Limiter
 * For general API endpoints
 * Limit: 100 requests per 15 minutes
 */
export const generalLimiter = rateLimit({
  store: new RedisRateLimitStore('general') as any,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * Strict Rate Limiter
 * For very sensitive operations (OTP, KYC uploads)
 * Limit: 3 requests per 15 minutes
 */
export const strictLimiter = rateLimit({
  store: new RedisRateLimitStore('strict') as any,
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    message: 'Too many attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/** OTP send/resend — 5 per 15 minutes per IP */
export const otpLimiter = rateLimit({
  store: new RedisRateLimitStore('otp') as any,
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: 5,
  message: {
    success: false,
    message: 'Too many OTP requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/** KYC document uploads — 10 per hour */
export const kycUploadLimiter = rateLimit({
  store: new RedisRateLimitStore('kyc_upload') as any,
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many uploads. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/** Withdrawals — 5 per hour */
export const withdrawalLimiter = rateLimit({
  store: new RedisRateLimitStore('withdrawal') as any,
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many withdrawal attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/** Support tickets / AI chat — 20 per 15 minutes */
export const supportLimiter = rateLimit({
  store: new RedisRateLimitStore('support') as any,
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Too many support requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/**
 * Donation payment verify polling — separate bucket from generalLimiter.
 * Mobile/web poll every ~2s while Flutterwave confirms; must not exhaust the
 * shared general limit and block begs, auth, etc.
 */
export const donationVerifyLimiter = rateLimit({
  store: new RedisRateLimitStore('donation_verify') as any,
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 120, // ~24 polls/min — enough for one checkout without starving other routes
  message: {
    success: false,
    message: 'Too many verification attempts. Please wait a moment and try again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

/** Reactions — 60 per 15 minutes */
export const reactionLimiter = rateLimit({
  store: new RedisRateLimitStore('reaction') as any,
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: {
    success: false,
    message: 'Too many reactions. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

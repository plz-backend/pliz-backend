import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { IApiResponse } from '../../types/user.interface';

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

/**
 * Auth Rate Limiter
 * For sensitive endpoints like login, register, password reset
 * Limit: 5 requests per 15 minutes
 */
export const authLimiter = rateLimit({
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
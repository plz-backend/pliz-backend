// src/middleware/rate-limit.ts

import rateLimit from 'express-rate-limit';

interface RateLimitOptions {
  max: number;
  windowMs: number;
  message?: string;
}

/**
 * Create a rate limiter middleware
 */
export const rateLimiter = (options: RateLimitOptions) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || 'Too many requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      req.logger?.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
      });
      
      res.status(429).json({
        error: options.message || 'Too many requests, please try again later',
        code: 'RATE_LIMIT_EXCEEDED',
      });
    },
  });
};

/**
 * Default rate limiter for API routes
 * 100 requests per 15 minutes
 */
export const apiLimiter = rateLimiter({
  max: 100,
  windowMs: 15 * 60 * 1000,
  message: 'Too many API requests, please try again in 15 minutes',
});

/**
 * Strict rate limiter for sensitive operations
 * 5 requests per minute
 */
export const strictLimiter = rateLimiter({
  max: 5,
  windowMs: 60 * 1000,
  message: 'Too many attempts, please wait a minute',
});

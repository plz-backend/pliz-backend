import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

import logger from '../config/logger';
import { runWithRequestContext } from '../config/request-context';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/**
 * Assigns a request ID, logs request lifecycle, and keeps context for downstream logs.
 * Cloud Run ingests stdout JSON — every log line can be tied to X-Request-Id.
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incomingId = req.headers['x-request-id'];
  const requestId =
    typeof incomingId === 'string' && incomingId.trim().length > 0
      ? incomingId.trim()
      : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const context = {
    requestId,
    method: req.method,
    path: req.path,
  };

  const startedAt = Date.now();

  runWithRequestContext(context, () => {
    logger.info('http.request.start', {
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
    });

    res.on('finish', () => {
      const durationMs = Date.now() - startedAt;
      const payload = {
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs,
      };

      if (res.statusCode >= 500) {
        logger.error('http.request.finish', payload);
      } else if (res.statusCode >= 400 || durationMs > 3000) {
        logger.warn('http.request.finish', payload);
      } else {
        logger.info('http.request.finish', payload);
      }
    });

    next();
  });
}

export function globalErrorHandler(
  error: Error & { status?: number },
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = error.status && error.status >= 400 ? error.status : 500;

  logger.error('http.request.error', {
    message: error.message,
    stack: error.stack,
    method: req.method,
    path: req.path,
    statusCode,
    requestId: req.requestId,
  });

  if (req.requestId) {
    res.setHeader('X-Request-Id', req.requestId);
  }

  res.status(statusCode).json({
    success: false,
    message: error.message || 'Internal server error',
    data: req.requestId ? { requestId: req.requestId } : undefined,
  });
}

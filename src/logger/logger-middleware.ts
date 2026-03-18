// src/logger/middleware.ts
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import logger from './logger-index';

// Extend Express Request type to include logger
declare global {
  namespace Express {
    interface Request {
      logger: any; // Winston child logger
      requestId: string;
    }
  }
}

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Generate unique request ID
  const requestId = uuidv4();
  req.requestId = requestId;
  
  // Extract user ID from request (adjust based on your auth setup)
  const userId = (req as any).user?.id || (req as any).userId;
  
  // Create request-specific logger
  req.logger = logger.forRequest(requestId, userId);
  
  // Log incoming request
  req.logger.http('Incoming request', {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
  });
  
  // Capture response
  const startTime = Date.now();
  
  // Store original send function
  const originalSend = res.send;
  
  res.send = function (data: any) {
    const duration = Date.now() - startTime;
    
    // Log response
    req.logger.http('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
    });
    
    // Log slow requests
    if (duration > 1000) {
      req.logger.warn('Slow request detected', {
        method: req.method,
        path: req.path,
        duration,
      });
    }
    
    // Call original send
    return originalSend.call(this, data);
  };
  
  next();
};

// Error logging middleware (should be last)
export const errorLogger = (
  err: Error, 
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  req.logger.error('Request error', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    statusCode: res.statusCode || 500,
  });
  
  next(err);
};

// Database query logger (for Prisma middleware)
export const createPrismaLogger = (moduleName: string) => {
  const moduleLogger = logger.forModule(moduleName);
  
  return async (params: any, next: any) => {
    const startTime = Date.now();
    
    try {
      const result = await next(params);
      const duration = Date.now() - startTime;
      
      // Log slow queries
      if (duration > 100) {
        moduleLogger.warn('Slow database query', {
          model: params.model,
          action: params.action,
          duration,
        });
      }
      
      // Debug log all queries in development
      if (process.env.NODE_ENV !== 'production') {
        moduleLogger.debug('Database query', {
          model: params.model,
          action: params.action,
          duration,
        });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      moduleLogger.error('Database query failed', {
        model: params.model,
        action: params.action,
        duration,
        error,
      });
      
      throw error;
    }
  };
};

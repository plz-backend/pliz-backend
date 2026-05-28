import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../../services/tokenService';
import { CacheService } from '../../services/cacheService';
import { IJWTPayload, IApiResponse } from '../../types/user.interface';
import logger from '../../../../config/logger';
import { setRequestUserId } from '../../../../config/request-context';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: IJWTPayload;
    }
  }
}

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user to request
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Authentication failed: No token provided', {
        ip: req.ip,
        path: req.path,
      });

      const response: IApiResponse = {
        success: false,
        message: 'Access denied. No token provided.',
      };

      res.status(401).json(response);
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Check if token is blacklisted
    const isBlacklisted = await CacheService.isTokenBlacklisted(token);
    
    if (isBlacklisted) {
      logger.warn('Authentication failed: Token is blacklisted', {
        ip: req.ip,
        path: req.path,
      });

      const response: IApiResponse = {
        success: false,
        message: 'Token has been revoked. Please login again.',
      };

      res.status(401).json(response);
      return;
    }

    // Verify token
    const decoded = TokenService.verifyAccessToken(token);

    if (!decoded) {
      logger.warn('Authentication failed: Invalid token', {
        ip: req.ip,
        path: req.path,
      });

      const response: IApiResponse = {
        success: false,
        message: 'Invalid or expired token. Please login again.',
      };

      res.status(401).json(response);
      return;
    }

    // Attach user to request
    req.user = decoded;
    setRequestUserId(decoded.userId);

    logger.debug('User authenticated successfully', {
      userId: decoded.userId,
      sessionId: decoded.sessionId,
      role: decoded.role,
      path: req.path,
    });

    next();
  } catch (error) {
    logger.error('Authentication middleware error', { error });

    const response: IApiResponse = {
      success: false,
      message: 'Authentication failed',
    };

    res.status(500).json(response);
  }
};

/**
 * Optional authentication — attaches user when a valid Bearer token is present;
 * continues anonymously when missing or invalid.
 */
export const authenticateOptional = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);
    const isBlacklisted = await CacheService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      next();
      return;
    }

    const decoded = TokenService.verifyAccessToken(token);
    if (decoded) {
      req.user = decoded;
      setRequestUserId(decoded.userId);
    }
    next();
  } catch {
    next();
  }
};
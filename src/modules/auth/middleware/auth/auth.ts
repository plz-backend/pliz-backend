import { Request, Response, NextFunction } from 'express';
import { TokenService } from '../../services/tokenService';
import { CacheService } from '../../services/cacheService';
import { IJWTPayload, IApiResponse } from '../../types/user.interface';
import logger from '../../../../config/logger';
import { setRequestUserId } from '../../../../config/request-context';
import prisma from '../../../../config/database';

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
    const session = await prisma.session.findUnique({
      where: { id: decoded.sessionId },
      select: { active: true, expiresAt: true, userId: true },
    });

    if (
      !session ||
      !session.active ||
      session.userId !== decoded.userId ||
      new Date() > session.expiresAt
    ) {
      logger.warn('Authentication failed: Session inactive or expired', {
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        path: req.path,
      });
      res.status(401).json({
        success: false,
        message: 'Session has expired. Please login again.',
      } satisfies IApiResponse);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        email: true,
        role: true,
        isSuspended: true,
        isTeamDisabled: true,
        isDeleted: true
      },
    });

    if (!user || user.isSuspended || user.isTeamDisabled || user.isDeleted) {
    logger.warn('Authentication failed: User disabled, deleted or missing', {
      userId: decoded.userId,
      path: req.path,
    });
    res.status(403).json({
      success: false,
      message: user?.isDeleted
        ? 'This account has been deleted. Contact support@plz.ng if this is a mistake.'
        : 'Account access is disabled.',
      code: user?.isDeleted ? 'ACCOUNT_DELETED' : 'ACCOUNT_DISABLED',
    } satisfies IApiResponse);
    return;
    }

    req.user = {
      ...decoded,
      email: user.email,
      role: user.role,
    } as IJWTPayload;
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
      const session = await prisma.session.findUnique({
        where: { id: decoded.sessionId },
        select: { active: true, expiresAt: true, userId: true },
      });
      if (session?.active && session.userId === decoded.userId && new Date() <= session.expiresAt) {
        req.user = decoded;
        setRequestUserId(decoded.userId);
      }
    }
    next();
  } catch {
    next();
  }
};

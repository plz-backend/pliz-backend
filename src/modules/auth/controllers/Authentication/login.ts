import { TokenService } from '../../services/tokenService';
import { CacheService } from '../../services/cacheService';
import { Request, Response } from 'express';
import { UserService } from '../../services/user.service';
import prisma from '../../../../config/database';  // 
import {
  ILoginRequest,
  IUserResponse,
  IApiResponse,
} from '../../types/user.interface';
import logger from '../../../../config/logger';



/**
 * Helper to send response
 */
const sendResponse = <T = any>(
  res: Response,
  statusCode: number,
  response: IApiResponse<T>
): void => {
  res.status(statusCode).json(response);
};

/**
 * @route   POST /api/auth/login
 * @desc    Login user and create session
 * @access  Public
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as ILoginRequest;
    logger.info('Login attempt', { email, ip: req.ip });

    // ============================================
    // FIND USER
    // ============================================
    const user = await UserService.findByEmail(email);

    if (!user) {
      logger.warn('Login failed: User not found', { email });
      const response: IApiResponse = {
        success: false,
        message: 'Invalid email or password',
      };
      sendResponse(res, 401, response);
      return;
    }

    // ============================================
    // VERIFY PASSWORD
    // ============================================
    const isPasswordValid = await UserService.comparePassword(
      password,
      user.passwordHash
    );

    if (!isPasswordValid) {
      logger.warn('Login failed: Invalid password', {
        userId: user.id,
        email,
      });
      const response: IApiResponse = {
        success: false,
        message: 'Invalid email or password',
      };
      sendResponse(res, 401, response);
      return;
    }

    // ============================================
    // CHECK EMAIL VERIFICATION
    // ============================================
    if (!user.isEmailVerified) {
      logger.warn('Login failed: Email not verified', {
        userId: user.id,
        email,
      });
      const response: IApiResponse = {
        success: false,
        message: 'Please verify your email before logging in',
      };
      sendResponse(res, 403, response);
      return;
    }

    // ============================================
    // CHECK IF ACCOUNT IS SUSPENDED
    // ============================================
    if (user.isSuspended) {
      logger.warn('Login failed: Account suspended', {
        userId: user.id,
        email,
      });
      const response: IApiResponse = {
        success: false,
        message: 'Your account has been suspended. Please contact support.',
      };
      sendResponse(res, 403, response);
      return;
    }

    // ============================================
    // PREPARE SESSION DATA
    // ============================================
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ipAddress = (
      req.ip ||
      req.socket.remoteAddress ||
      'Unknown'
    ).replace('::ffff:', '');

    // ✅ Generate a temporary session ID for token generation
    const crypto = require('crypto');
    const tempSessionId = crypto.randomUUID();

    // ============================================
    // GENERATE REFRESH TOKEN FIRST
    // ============================================
    // ✅ Generate refresh token BEFORE creating session
    const refreshToken = TokenService.generateRefreshToken(
      user.id,
      user.email,
      user.role,
      tempSessionId  // Use temp ID first
    );

    // ============================================
    // CREATE SESSION WITH REFRESH TOKEN
    // ============================================
    // ✅ Create session in database WITH refreshToken
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        userAgent,
        ipAddress,
        refreshToken,  // ✅ Include refresh token
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // ============================================
    // GENERATE TOKENS WITH REAL SESSION ID
    // ============================================
    // ✅ Generate access token with real session ID
    const accessToken = TokenService.generateAccessToken(
      user.id,
      user.email,
      user.role,
      session.id  // Real session ID
    );

    // ✅ Re-generate refresh token with real session ID
    const finalRefreshToken = TokenService.generateRefreshToken(
      user.id,
      user.email,
      user.role,
      session.id  // Real session ID
    );

    // ✅ Update session with correct refresh token
    await prisma.session.update({
      where: { id: session.id },
      data: { refreshToken: finalRefreshToken },
    });

    // ✅ Store refresh token in Redis cache
    await CacheService.setRefreshToken(session.id, finalRefreshToken);

    // ============================================
    // CACHE USER SESSION (OPTIONAL)
    // ============================================
    await CacheService.cacheUserSession(
      user.id,
      {
        email: user.email,
        username: user.username,
        role: user.role,
        lastLogin: new Date(),
      },
      15 * 60 // 15 minutes
    );

    logger.info('Login successful', {
      userId: user.id,
      email,
      sessionId: session.id,
      role: user.role,
    });

    // ============================================
    // PREPARE RESPONSE
    // ============================================
    const userResponse: IUserResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      isProfileComplete: user.isProfileComplete,
      isSuspended: user.isSuspended,
      isUnderInvestigation: user.isUnderInvestigation,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    const response: IApiResponse<{
      user: IUserResponse;
      accessToken: string;
      refreshToken: string;
    }> = {
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        accessToken,
        refreshToken: finalRefreshToken,  // ✅ Use final refresh token
      },
    };

    sendResponse(res, 200, response);
  } catch (error: any) {
    logger.error('Login error', {
      error: error.message,
      stack: error.stack,
    });

    const response: IApiResponse = {
      success: false,
      message: 'Login failed. Please try again.',
    };

    sendResponse(res, 500, response);
  }
};
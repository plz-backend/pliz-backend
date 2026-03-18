// ========== DATABASE: Signup with email verification ==========

import { Request, Response } from 'express';
import { UserService } from '../../services/user.service';
import { TokenService } from '../../services/tokenService';
import { EmailService } from '../../services/emailService'; 
import { CacheService } from '../../services/cacheService'; 
import { TrustScoreService } from '../../../../../src/services/trust_score.service';
import {
  IRegisterRequest,
  IUserResponse,
  IApiResponse,
   UserRole, 
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
 * @route   POST /api/auth/register
 * @desc    Register new user (Step 1: Creates 'user' role ONLY)
 * @access  Public
 */
export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password, confirmPassword } = req.body as IRegisterRequest;

    logger.info('Registration attempt', {
      username,
      email,
      ip: req.ip,
    });

    // ============================================
    // VALIDATION
    // ============================================
    if (!username || !email || !password || !confirmPassword) {
      sendResponse(res, 400, {
        success: false,
        message: 'All fields are required',
      });
      return;
    }

    // Check password match
    if (password !== confirmPassword) {
      sendResponse(res, 400, {
        success: false,
        message: 'Passwords do not match',
      });
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      sendResponse(res, 400, {
        success: false,
        message: 'Password must be at least 8 characters long',
      });
      return;
    }

    // ============================================
    // CHECK IF USER EXISTS
    // ============================================
    const existingUser = await UserService.findByEmailOrUsername(
      email,
      username
    );

    if (existingUser) {
      if (existingUser.email === email.toLowerCase()) {
        logger.warn('Registration failed: Email already exists', { email });
        sendResponse(res, 409, {
          success: false,
          message: 'User with this email already exists',
        });
        return;
      }

      if (existingUser.username === username.toLowerCase()) {
        logger.warn('Registration failed: Username already exists', {
          username,
        });
        sendResponse(res, 409, {
          success: false,
          message: 'Username already taken',
        });
        return;
      }
    }

    logger.info('Creating user with email verification disabled', {
      username,
      email,
      role: UserRole.user,  // ✅ Log the role
      isEmailVerified: false,
    });

    // ============================================
    // CREATE USER (HARDCODED 'user' ROLE)
    // ============================================
    const user = await UserService.createUser({
      username,
      email,
      password,
      role: UserRole.user  // ALWAYS 'user' for public registration
    });

    // ============================================
    // INITIALIZE TRUST & STATS
    // ============================================
    await TrustScoreService.initializeUserTrust(user.id);
    logger.info('User trust initialized', { userId: user.id });

    // ============================================
    // EMAIL VERIFICATION
    // ============================================
    const emailToken = TokenService.generateEmailToken();

    // Store token in Redis cache (expires in 24 hours)
    await CacheService.storeEmailToken(
      email.toLowerCase(),
      emailToken,
      86400  // 24 hours
    );

    logger.info('Email verification token generated', {
      email,
      expiresIn: '24h',
    });

    // Send verification email (non-blocking)
    EmailService.sendVerificationEmail(email, emailToken).catch((error) => {
      logger.error('Failed to send verification email', { error, email });
    });

    logger.info('User registered successfully', {
      userId: user.id,
      username,
      email,
      role: user.role,  // ✅ Log the role
    });

    // ============================================
    // PREPARE RESPONSE
    // ============================================
    const userResponse: IUserResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,  // ✅ Include role in response
      isEmailVerified: user.isEmailVerified,
      emailVerifiedAt: user.emailVerifiedAt,
      isProfileComplete: false,
      isSuspended: user.isSuspended,
      isUnderInvestigation: user.isUnderInvestigation,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    sendResponse(res, 201, {
      success: true,
      message:
        'Registration successful! Please check your email to verify your account, then complete your profile.',
      data: {
        user: userResponse,
      },
    });
  } catch (error: any) {
    logger.error('Registration error', {
      error: error.message,
      stack: error.stack,
    });

    // Prisma unique constraint
    if (error?.code === 'P2002') {
      const field = error.meta?.target?.[0] ?? 'field';
      sendResponse(res, 409, {
        success: false,
        message: `${field} already exists`,
      });
      return;
    }

    sendResponse(res, 500, {
      success: false,
      message: 'Registration failed. Please try again.',
    });
  }
};
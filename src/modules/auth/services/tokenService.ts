import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { IJWTPayload } from '../types/user.interface';
import { UserRole } from '../types/user.interface';
import logger from '../../../config/logger';

/**
 * Token Service
 * Handles JWT operations
 */
export class TokenService {
  /**
   * Get JWT Secret
   */
  private static getJWTSecret(): Secret {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }
    return secret;
  }

  /**
   * Get JWT Refresh Secret
   */
  private static getJWTRefreshSecret(): Secret {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not defined in environment variables');
    }
    return secret;
  }

  /**
   * Generate Access Token
   * ✅ UPDATED: Added role parameter and made sessionId required
   */
  static generateAccessToken(
    userId: string,
    email: string,
    role: UserRole,      // Added role
    sessionId: string     //  Made required (not optional)
  ): string {
    const payload: Omit<IJWTPayload, 'iat' | 'exp'> = {
      userId,
      email,
      role,           //  Include role
      type: 'access',
      sessionId,
    };

    const secret: Secret = this.getJWTSecret();
    
    const options: SignOptions = {
      expiresIn: '15m',
    };

    return jwt.sign(payload, secret, options);
  }

  /**
   * Generate Refresh Token
   * ✅ UPDATED: Added role parameter and made sessionId required
   */
  static generateRefreshToken(
    userId: string,
    email: string,
    role: UserRole,      // ✅ Added role
    sessionId: string     // ✅ Made required (not optional)
  ): string {
    const payload: Omit<IJWTPayload, 'iat' | 'exp'> = {
      userId,
      email,
      role,           // ✅ Include role
      type: 'refresh',
      sessionId,
    };

    const secret: Secret = this.getJWTRefreshSecret();
    
    const options: SignOptions = {
      expiresIn: '7d',
    };

    return jwt.sign(payload, secret, options);
  }

  /**
   * Verify Access Token
   */
  static verifyAccessToken(token: string): IJWTPayload | null {
    try {
      const secret: Secret = this.getJWTSecret();
      const decoded = jwt.verify(token, secret) as IJWTPayload;

      if (decoded.type !== 'access') {
        logger.warn('Invalid token type for access token', { type: decoded.type });
        return null;
      }

      return decoded;
    } catch (error) {
      logger.error('Access token verification failed', { error });
      return null;
    }
  }

  /**
   * Verify Refresh Token
   */
  static verifyRefreshToken(token: string): IJWTPayload | null {
    try {
      const secret: Secret = this.getJWTRefreshSecret();
      const decoded = jwt.verify(token, secret) as IJWTPayload;

      if (decoded.type !== 'refresh') {
        logger.warn('Invalid token type for refresh token', { type: decoded.type });
        return null;
      }

      return decoded;
    } catch (error) {
      logger.error('Refresh token verification failed', { error });
      return null;
    }
  }

  /**
   * Generate Email Verification Token
   */
  static generateEmailToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate Email OTP (6 digits)
   * NEW METHOD
   */
  static generateEmailOTP(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate Password Reset Token
   * NEW METHOD
   */
  static generatePasswordResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Decode Token Without Verification
   */
  static decodeToken(token: string): IJWTPayload | null {
    try {
      const decoded = jwt.decode(token) as IJWTPayload;
      return decoded;
    } catch (error) {
      logger.error('Token decode failed', { error });
      return null;
    }
  }
}
// ========== CACHE: Redis cache service for tokens and sessions ==========
import redisClient from '../../../config/redis';
import logger from '../../../config/logger';

/**
 * Cache Service
 * Handles Redis operations for authentication
 */
export class CacheService {
  // ============================================
  // TOKEN BLACKLIST
  // ============================================

  /**
   * Blacklist a token (for logout)
   */
  static async blacklistToken(token: string, expirySeconds: number = 900): Promise<void> {
    try {
      const client = redisClient.getClient();
      const key = `blacklist:${token}`;
      
      await client.setEx(key, expirySeconds, 'true');
      
      logger.info('Token blacklisted', { 
        tokenPrefix: token.substring(0, 20) + '...',
        expirySeconds 
      });
    } catch (error) {
      logger.error('Failed to blacklist token', { error });
      throw error;
    }
  }

  /**
   * Check if a token is blacklisted
   */
  static async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const client = redisClient.getClient();
      const key = `blacklist:${token}`;
      
      const result = await client.get(key);
      return result !== null;
    } catch (error) {
      logger.error('Failed to check token blacklist', { error });
      // If Redis fails, allow the request (fail open for availability)
      return false;
    }
  }

  // ============================================
  // REFRESH TOKENS (SESSION MANAGEMENT)
  // ============================================

  /**
   * Store refresh token for a session
   * ✅ NEW METHOD
   */
  static async setRefreshToken(
    sessionId: string,
    refreshToken: string,
    expirySeconds: number = 604800 // 7 days
  ): Promise<void> {
    try {
      const client = redisClient.getClient();
      const key = `refresh_token:${sessionId}`;
      
      await client.setEx(key, expirySeconds, refreshToken);
      
      logger.debug('Refresh token stored', { sessionId, expirySeconds });
    } catch (error) {
      logger.error('Failed to store refresh token', { error, sessionId });
      throw error;
    }
  }

  /**
   * Get refresh token for a session
   * ✅ NEW METHOD
   */
  static async getRefreshToken(sessionId: string): Promise<string | null> {
    try {
      const client = redisClient.getClient();
      const key = `refresh_token:${sessionId}`;
      
      const token = await client.get(key);
      
      logger.debug('Refresh token retrieved', { sessionId, found: !!token });
      return token;
    } catch (error) {
      logger.error('Failed to get refresh token', { error, sessionId });
      return null;
    }
  }

  /**
   * Delete refresh token for a session
   * ✅ NEW METHOD - This was missing!
   */
  static async deleteRefreshToken(sessionId: string): Promise<void> {
    try {
      const client = redisClient.getClient();
      const key = `refresh_token:${sessionId}`;
      
      await client.del(key);
      
      logger.debug('Refresh token deleted', { sessionId });
    } catch (error) {
      logger.error('Failed to delete refresh token', { error, sessionId });
      // Don't throw - cache deletion is optional
    }
  }

  // ============================================
  // USER SESSION CACHE
  // ============================================

  /**
   * Cache user session data
   */
  static async cacheUserSession(
    userId: string,
    userData: any,
    expirySeconds: number = 900
  ): Promise<void> {
    try {
      const client = redisClient.getClient();
      const key = `session:${userId}`;
      
      await client.setEx(key, expirySeconds, JSON.stringify(userData));
      
      logger.debug('User session cached', { userId });
    } catch (error) {
      logger.error('Failed to cache user session', { error, userId });
      // Don't throw - caching is optional
    }
  }

  /**
   * Get cached user session
   */
  static async getUserSession(userId: string): Promise<any | null> {
    try {
      const client = redisClient.getClient();
      const key = `session:${userId}`;
      
      const data = await client.get(key);
      
      if (data) {
        return JSON.parse(data);
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to get user session from cache', { error, userId });
      return null;
    }
  }

  /**
   * Delete user session from cache
   */
  static async deleteUserSession(userId: string): Promise<void> {
    try {
      const client = redisClient.getClient();
      const key = `session:${userId}`;
      
      await client.del(key);
      
      logger.debug('User session deleted from cache', { userId });
    } catch (error) {
      logger.error('Failed to delete user session', { error, userId });
      // Don't throw - cache deletion is optional
    }
  }

  // ============================================
  // EMAIL VERIFICATION OTP
  // ============================================

  /**
   * Store email verification OTP
   * ✅ NEW METHOD
   */
  static async setEmailOTP(
    email: string,
    otp: string,
    expirySeconds: number = 600 // 10 minutes
  ): Promise<void> {
    try {
      const client = redisClient.getClient();
      const key = `email_otp:${email.toLowerCase()}`;
      
      await client.setEx(key, expirySeconds, otp);
      
      logger.info('Email OTP stored', { email, expirySeconds });
    } catch (error) {
      logger.error('Failed to store email OTP', { error, email });
      throw error;
    }
  }

  /**
   * Get email verification OTP
   * ✅ NEW METHOD
   */
  static async getEmailOTP(email: string): Promise<string | null> {
    try {
      const client = redisClient.getClient();
      const key = `email_otp:${email.toLowerCase()}`;
      
      const otp = await client.get(key);
      
      logger.debug('Email OTP retrieved', { email, found: !!otp });
      return otp;
    } catch (error) {
      logger.error('Failed to get email OTP', { error, email });
      return null;
    }
  }

  /**
   * Delete email verification OTP
   * ✅ NEW METHOD
   */
  static async deleteEmailOTP(email: string): Promise<void> {
    try {
      const client = redisClient.getClient();
      const key = `email_otp:${email.toLowerCase()}`;
      
      await client.del(key);
      
      logger.debug('Email OTP deleted', { email });
    } catch (error) {
      logger.error('Failed to delete email OTP', { error, email });
    }
  }

  // ============================================
  // EMAIL VERIFICATION TOKEN
  // ============================================

  /**
   * Store email verification token
   */
  static async storeEmailToken(
    email: string,
    token: string,
    expirySeconds: number = 86400
  ): Promise<void> {
    try {
      const client = redisClient.getClient();
      const emailLower = email.toLowerCase();
      const key = `email_token:${emailLower}`;
      const tokenKey = `email_verify_token:${token}`;

      await client.setEx(key, expirySeconds, token);
      await client.setEx(tokenKey, expirySeconds, emailLower);

      logger.info('Email verification token stored', { email: emailLower });
    } catch (error) {
      logger.error('Failed to store email token', { error, email });
      throw error;
    }
  }

  /**
   * Resolve email from verification token (O(1); avoids Redis KEYS on serverless hosts).
   */
  static async verifyEmailToken(token: string): Promise<string | null> {
    try {
      const client = redisClient.getClient();
      const byToken = await client.get(`email_verify_token:${token}`);
      if (byToken) {
        return byToken;
      }

      const keys = await client.keys('email_token:*');
      for (const key of keys) {
        const storedToken = await client.get(key);
        if (storedToken === token) {
          return key.replace('email_token:', '');
        }
      }

      return null;
    } catch (error) {
      logger.error('Failed to verify email token', { error });
      return null;
    }
  }

  /**
   * Delete email token
   */
  static async deleteEmailToken(email: string): Promise<void> {
    try {
      const client = redisClient.getClient();
      const key = `email_token:${email.toLowerCase()}`;
      const storedToken = await client.get(key);

      await client.del(key);
      if (storedToken) {
        await client.del(`email_verify_token:${storedToken}`);
      }

      logger.debug('Email token deleted', { email });
    } catch (error) {
      logger.error('Failed to delete email token', { error, email });
    }
  }

  // ============================================
  // PASSWORD RESET
  // ============================================

  /**
   * Store password reset token (mapped by token, not email)
   * ✅ IMPROVED METHOD
   */
  static async setPasswordResetToken(
    token: string,
    email: string,
    expirySeconds: number = 3600 // 1 hour
  ): Promise<void> {
    try {
      const client = redisClient.getClient();
      const key = `password_reset:${token}`;
      
      await client.setEx(key, expirySeconds, email.toLowerCase());
      
      logger.info('Password reset token stored', { email, expirySeconds });
    } catch (error) {
      logger.error('Failed to store password reset token', { error, email });
      throw error;
    }
  }

  /**
   * Get email from password reset token
   * ✅ IMPROVED METHOD
   */
  static async getPasswordResetToken(token: string): Promise<string | null> {
    try {
      const client = redisClient.getClient();
      const key = `password_reset:${token}`;
      
      const email = await client.get(key);
      
      logger.debug('Password reset token retrieved', { found: !!email });
      return email;
    } catch (error) {
      logger.error('Failed to get password reset token', { error });
      return null;
    }
  }

  /**
   * Delete password reset token
   * ✅ IMPROVED METHOD
   */
  static async deletePasswordResetToken(token: string): Promise<void> {
    try {
      const client = redisClient.getClient();
      const key = `password_reset:${token}`;
      
      await client.del(key);
      
      logger.debug('Password reset token deleted');
    } catch (error) {
      logger.error('Failed to delete password reset token', { error });
    }
  }

  /**
   * Store password reset token (legacy method - kept for backward compatibility)
   * @deprecated Use setPasswordResetToken instead
   */
  static async storePasswordResetToken(
    email: string,
    token: string,
    expirySeconds: number = 3600
  ): Promise<void> {
    // Redirect to new method with correct parameter order
    return this.setPasswordResetToken(token, email, expirySeconds);
  }

  /**
   * Verify password reset token (legacy method - kept for backward compatibility)
   * @deprecated Use getPasswordResetToken instead
   */
  static async verifyPasswordResetToken(token: string): Promise<string | null> {
    return this.getPasswordResetToken(token);
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Clear all cache (use with caution)
   */
  static async clearAll(): Promise<void> {
    try {
      const client = redisClient.getClient();
      await client.flushDb();
      
      logger.warn('All cache cleared');
    } catch (error) {
      logger.error('Failed to clear cache', { error });
      throw error;
    }
  }
}
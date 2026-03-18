// ========== SESSION: Session service using Prisma with PostgreSQL ==========
// Matches session_manager table schema
import prisma from '../../../config/database';
import { IDeviceInfo, ISessionResponse, ISession } from '../types/user.interface';
import logger from '../../../config/logger';
import { SecurityConfig } from '../../../config/security';

/**
 * Session Service
 * Handles all multi-session management operations
 */
export class SessionService {
  /**
   * Parse User Agent to extract device information
   */
  static parseUserAgent(userAgent: string | null): IDeviceInfo {
    const ua = userAgent || 'Unknown';

    const deviceInfo: IDeviceInfo = {
      userAgent: ua,
      browser: 'Unknown',
      os: 'Unknown',
      device: 'Desktop',
    };

    // Detect Browser
    if (ua.includes('Edg')) deviceInfo.browser = 'Edge';
    else if (ua.includes('Chrome')) deviceInfo.browser = 'Chrome';
    else if (ua.includes('Firefox')) deviceInfo.browser = 'Firefox';
    else if (ua.includes('Safari')) deviceInfo.browser = 'Safari';
    else if (ua.includes('Opera') || ua.includes('OPR'))
      deviceInfo.browser = 'Opera';

    // Detect Operating System
    if (ua.includes('Windows')) deviceInfo.os = 'Windows';
    else if (ua.includes('Mac OS') || ua.includes('Macintosh'))
      deviceInfo.os = 'macOS';
    else if (ua.includes('Linux')) deviceInfo.os = 'Linux';
    else if (ua.includes('Android')) deviceInfo.os = 'Android';
    else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad'))
      deviceInfo.os = 'iOS';

    // Detect Device Type
    if (ua.includes('Mobile')) deviceInfo.device = 'Mobile';
    else if (ua.includes('Tablet') || ua.includes('iPad'))
      deviceInfo.device = 'Tablet';
    else deviceInfo.device = 'Desktop';

    return deviceInfo;
  }

  /**
   * Transform Prisma session to ISession interface
   */
  private static transformToISession(prismaSession: any): ISession {
    return {
      id: prismaSession.id,
      userId: prismaSession.userId,
      refreshToken: prismaSession.refreshToken,
      active: prismaSession.active,
      lastActive: prismaSession.lastActive,
      expiresAt: prismaSession.expiresAt,
      userAgent: prismaSession.userAgent,
      browser: prismaSession.browser,
      os: prismaSession.os,
      device: prismaSession.device,
      ipAddress: prismaSession.ipAddress,
      country: prismaSession.country,
      city: prismaSession.city,
      createdAt: prismaSession.createdAt,
      updatedAt: prismaSession.updatedAt,
    };
  }

  /**
   * Create a new session
   * ========== SESSION: Creates session in session_manager table ==========
   */
  static async createSession(
    userId: string,
    userAgent: string,
    ipAddress: string,
    refreshToken?: string
  ): Promise<ISession> {
    try {
      const deviceInfo = this.parseUserAgent(userAgent);

      // Calculate expiry (7 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(
        expiresAt.getDate() + (SecurityConfig.session?.expiryDays || 7)
      );

      const sessionData: any = {
        userId,
        userAgent: deviceInfo.userAgent,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        device: deviceInfo.device,
        ipAddress,
        active: true,
        lastActive: new Date(),
        expiresAt,
        // createdAt and updatedAt are auto-managed by Prisma
      };

      // Add refreshToken if provided (optional)
      if (refreshToken) {
        sessionData.refreshToken = refreshToken;
      }

      const session = await prisma.session.create({
        data: sessionData,
      });

      logger.info('Session created successfully', {
        userId,
        sessionId: session.id,
        device: deviceInfo.device,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        ipAddress,
      });

      return this.transformToISession(session);
    } catch (error) {
      logger.error('Failed to create session', { error, userId });
      throw error;
    }
  }

 /**
 * Get all active sessions for a user
 */
static async getUserSessions(
  userId: string,
  currentSessionId?: string
): Promise<ISessionResponse[]> {
  try {
    const sessions = await prisma.session.findMany({
      where: {
        userId,
        active: true,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActive: 'desc' },
    });

    return sessions.map((session): ISessionResponse => {
      // Parse device info
      const deviceInfo: IDeviceInfo = {
        userAgent: session.userAgent || 'Unknown',
        browser: session.browser || 'Unknown',
        os: session.os || 'Unknown',
        device: session.device || 'Desktop',
      };

      return {
        // All ISession fields
        id: session.id,
        userId: session.userId,
        refreshToken: session.refreshToken,
        active: session.active,
        lastActive: session.lastActive,
        expiresAt: session.expiresAt,
        userAgent: session.userAgent,
        browser: session.browser,
        os: session.os,
        device: session.device,
        ipAddress: session.ipAddress,
        country: session.country,
        city: session.city,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        
        // Additional formatted fields
        deviceInfo,
        formattedIpAddress: session.ipAddress || 'Unknown',
        location: {
          country: session.country || undefined,
          city: session.city || undefined,
        },
        isCurrent: currentSessionId === session.id,
      };
    });
  } catch (error) {
    logger.error('Failed to get user sessions', { error, userId });
    throw error;
  }
}

  /**
   * Get all active sessions (simple format)
   */
  static async getActiveSessions(userId: string): Promise<ISession[]> {
    try {
      const sessions = await prisma.session.findMany({
        where: {
          userId,
          active: true,
        },
        orderBy: {
          lastActive: 'desc',
        },
      });

      return sessions.map((session) => this.transformToISession(session));
    } catch (error) {
      logger.error('Failed to get active sessions', { error, userId });
      return [];
    }
  }

  /**
   * Get session by ID
   */
  static async getSessionById(sessionId: string): Promise<ISession | null> {
    try {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) return null;

      return this.transformToISession(session);
    } catch (error) {
      logger.error('Failed to get session by ID', { error, sessionId });
      return null;
    }
  }

  /**
   * Get session by refresh token (unified method)
   */
  static async findSessionByRefreshToken(
    refreshToken: string
  ): Promise<ISession | null> {
    try {
      const session = await prisma.session.findFirst({
        where: {
          refreshToken,
          active: true,
        },
      });

      if (!session) return null;

      return this.transformToISession(session);
    } catch (error) {
      logger.error('Failed to get session by refresh token', { error });
      return null;
    }
  }

  /**
   * Alias for findSessionByRefreshToken (for backward compatibility)
   */
  static async getSessionByRefreshToken(
    refreshToken: string
  ): Promise<ISession | null> {
    return this.findSessionByRefreshToken(refreshToken);
  }

  /**
   * Update session last active time
   */
  static async updateLastActive(sessionId: string): Promise<void> {
    try {
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          lastActive: new Date(),
          // updatedAt automatically updated by Prisma @updatedAt
        },
      });

      logger.debug('Session last active updated', { sessionId });
    } catch (error) {
      logger.error('Failed to update session last active', {
        error,
        sessionId,
      });
    }
  }

  /**
   * Update session activity (alias)
   */
  static async updateSessionActivity(sessionId: string): Promise<void> {
    return this.updateLastActive(sessionId);
  }

  /**
   * Deactivate a specific session
   * ✅ updatedAt is automatically updated by Prisma
   */
  static async deactivateSession(sessionId: string): Promise<boolean> {
    try {
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          active: false,
          // updatedAt automatically updated by Prisma @updatedAt
        },
      });

      logger.info('Session deactivated successfully', { sessionId });
      return true;
    } catch (error) {
      logger.error('Failed to deactivate session', { error, sessionId });
      return false;
    }
  }

  /**
   * Deactivate all sessions for a user
   * ✅ updatedAt is automatically updated by Prisma for all records
   */
  static async deactivateAllUserSessions(userId: string): Promise<number> {
    try {
      const result = await prisma.session.updateMany({
        where: {
          userId,
          active: true,
        },
        data: {
          active: false,
          // updatedAt automatically updated by Prisma @updatedAt
        },
      });

      logger.info('All user sessions deactivated', {
        userId,
        count: result.count,
      });

      return result.count;
    } catch (error) {
      logger.error('Failed to deactivate all user sessions', {
        error,
        userId,
      });
      return 0;
    }
  }

  /**
   * Alias for deactivateAllUserSessions
   */
  static async deactivateAllSessions(userId: string): Promise<number> {
    return this.deactivateAllUserSessions(userId);
  }

  /**
   * Deactivate all sessions except current
   * ✅ updatedAt is automatically updated by Prisma
   */
  static async deactivateOtherSessions(
    userId: string,
    currentSessionId: string
  ): Promise<number> {
    try {
      const result = await prisma.session.updateMany({
        where: {
          userId,
          id: { not: currentSessionId },
          active: true,
        },
        data: {
          active: false,
          // updatedAt automatically updated by Prisma @updatedAt
        },
      });

      logger.info('Other user sessions deactivated', {
        userId,
        currentSessionId,
        count: result.count,
      });

      return result.count;
    } catch (error) {
      logger.error('Failed to deactivate other sessions', {
        error,
        userId,
        currentSessionId,
      });
      return 0;
    }
  }

  /**
   * Update session refresh token
   *
   */
  static async updateRefreshToken(
    sessionId: string,
    refreshToken: string
  ): Promise<boolean> {
    try {
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          refreshToken,
          // updatedAt automatically updated by Prisma @updatedAt
        },
      });

      logger.debug('Session refresh token updated', { sessionId });
      return true;
    } catch (error) {
      logger.error('Failed to update session refresh token', {
        error,
        sessionId,
      });
      return false;
    }
  }

  /**
   * Update session location
   * ✅ updatedAt is automatically updated by Prisma
   */
  static async updateSessionLocation(
    sessionId: string,
    country?: string,
    city?: string
  ): Promise<void> {
    try {
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          country,
          city,
          // updatedAt automatically updated by Prisma @updatedAt
        },
      });

      logger.debug('Session location updated', { sessionId, country, city });
    } catch (error) {
      logger.error('Failed to update session location', {
        error,
        sessionId,
      });
    }
  }

  /**
   * Delete expired sessions (cleanup job)
   */
  static async deleteExpiredSessions(): Promise<number> {
    try {
      const result = await prisma.session.deleteMany({
        where: {
          expiresAt: { lt: new Date() },
        },
      });

      logger.info('Expired sessions deleted', { count: result.count });
      return result.count;
    } catch (error) {
      logger.error('Failed to delete expired sessions', { error });
      return 0;
    }
  }

  /**
   * Delete inactive sessions older than specified days
   */
  static async deleteInactiveSessions(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await prisma.session.deleteMany({
        where: {
          active: false,
          updatedAt: { lt: cutoffDate },
        },
      });

      logger.info('Inactive sessions deleted', {
        count: result.count,
        daysOld,
      });
      return result.count;
    } catch (error) {
      logger.error('Failed to delete inactive sessions', { error });
      return 0;
    }
  }

  /**
   * Delete a specific session
   */
  static async deleteSession(sessionId: string): Promise<boolean> {
    try {
      await prisma.session.delete({
        where: { id: sessionId },
      });

      logger.info('Session deleted', { sessionId });
      return true;
    } catch (error) {
      logger.error('Failed to delete session', { error, sessionId });
      return false;
    }
  }

  /**
   * Delete all sessions for a user
   */
  static async deleteAllUserSessions(userId: string): Promise<number> {
    try {
      const result = await prisma.session.deleteMany({
        where: { userId },
      });

      logger.info('All user sessions deleted', { userId, count: result.count });
      return result.count;
    } catch (error) {
      logger.error('Failed to delete all user sessions', { error, userId });
      return 0;
    }
  }

  /**
   * Count active sessions for a user
   */
  static async countUserSessions(userId: string): Promise<number> {
    try {
      return await prisma.session.count({
        where: {
          userId,
          active: true,
          expiresAt: { gt: new Date() },
        },
      });
    } catch (error) {
      logger.error('Failed to count user sessions', { error, userId });
      return 0;
    }
  }

  /**
   * Count total sessions (all users)
   */
  static async countAllActiveSessions(): Promise<number> {
    try {
      return await prisma.session.count({
        where: {
          active: true,
          expiresAt: { gt: new Date() },
        },
      });
    } catch (error) {
      logger.error('Failed to count all active sessions', { error });
      return 0;
    }
  }

  /**
   * Get session statistics
   */
  static async getSessionStats(): Promise<{
    totalActive: number;
    totalInactive: number;
    totalExpired: number;
    uniqueUsers: number;
  }> {
    try {
      const now = new Date();

      const [totalActive, totalInactive, totalExpired, uniqueUsers] =
        await Promise.all([
          prisma.session.count({
            where: { active: true, expiresAt: { gt: now } },
          }),
          prisma.session.count({
            where: { active: false },
          }),
          prisma.session.count({
            where: { expiresAt: { lt: now } },
          }),
          prisma.session.findMany({
            where: { active: true },
            select: { userId: true },
            distinct: ['userId'],
          }),
        ]);

      return {
        totalActive,
        totalInactive,
        totalExpired,
        uniqueUsers: uniqueUsers.length,
      };
    } catch (error) {
      logger.error('Failed to get session stats', { error });
      return {
        totalActive: 0,
        totalInactive: 0,
        totalExpired: 0,
        uniqueUsers: 0,
      };
    }
  }

  /**
   * Extend session expiry
   * 
   */
  static async extendSession(
    sessionId: string,
    additionalDays: number = 7
  ): Promise<boolean> {
    try {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        logger.warn('Session not found for extension', { sessionId });
        return false;
      }

      const newExpiresAt = new Date(session.expiresAt);
      newExpiresAt.setDate(newExpiresAt.getDate() + additionalDays);

      await prisma.session.update({
        where: { id: sessionId },
        data: {
          expiresAt: newExpiresAt,
          // updatedAt automatically updated by Prisma @updatedAt
        },
      });

      logger.info('Session expiry extended', {
        sessionId,
        additionalDays,
        newExpiresAt,
      });
      return true;
    } catch (error) {
      logger.error('Failed to extend session', { error, sessionId });
      return false;
    }
  }

  /**
   * Check if session is valid
   */
  static async isSessionValid(sessionId: string): Promise<boolean> {
    try {
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) return false;

      const now = new Date();
      return session.active && session.expiresAt > now;
    } catch (error) {
      logger.error('Failed to check session validity', { error, sessionId });
      return false;
    }
  }
}
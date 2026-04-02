import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import crypto from 'crypto';
import prisma from '../../../config/database';
import { TokenService } from './tokenService';
import { IOAuthProfile } from '../types/user.interface';
import logger from '../../../config/logger';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export class OAuthService {

  // ============================================
  // GOOGLE
  // ============================================

  /**
   * Verify Google ID token sent from mobile SDK
   */
  static async verifyGoogleToken(idToken: string): Promise<IOAuthProfile> {
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload) throw new Error('Invalid Google token');
      if (!payload.email) throw new Error('Google account has no email address');

      return {
        provider: 'google',
        providerId: payload.sub,
        email: payload.email,
        firstName: payload.given_name,
        lastName: payload.family_name,
        displayName: payload.name,
        avatar: payload.picture,
      };
    } catch (error: any) {
      logger.error('Google token verification failed', { error: error.message });
      throw new Error('Invalid Google token. Please try again.');
    }
  }

  // ============================================
  // APPLE
  // ============================================

  /**
   * Verify Apple ID token sent from mobile SDK
   * NOTE: Apple only sends name on the VERY FIRST login
   * subsequent logins won't have name — save it immediately
   */
  static async verifyAppleToken(idToken: string): Promise<IOAuthProfile> {
    try {
      const payload = await appleSignin.verifyIdToken(idToken, {
        audience: process.env.APPLE_CLIENT_ID,
        ignoreExpiration: false,
      });

      if (!payload.sub) throw new Error('Invalid Apple token');

      return {
        provider: 'apple',
        providerId: payload.sub,
        // Apple may hide real email and use relay email
        email: payload.email || `${payload.sub}@privaterelay.appleid.com`,
      };
    } catch (error: any) {
      logger.error('Apple token verification failed', { error: error.message });
      throw new Error('Invalid Apple token. Please try again.');
    }
  }

  // ============================================
  // FIND OR CREATE USER
  // ============================================

  static async findOrCreateUser(profile: IOAuthProfile): Promise<{
    user: any;
    isNewUser: boolean;
  }> {
    try {
      // 1. Check if user exists by provider ID
      const existingByProvider = await prisma.user.findFirst({
        where:
          profile.provider === 'google'
            ? { googleId: profile.providerId }
            : { appleId: profile.providerId },
        include: { profile: true },
      });

      if (existingByProvider) {
        logger.info('OAuth user found by provider ID', {
          userId: existingByProvider.id,
          provider: profile.provider,
        });
        return { user: existingByProvider, isNewUser: false };
      }

      // 2. Check if email already registered — link accounts
      const existingByEmail = await prisma.user.findUnique({
        where: { email: profile.email },
        include: { profile: true },
      });

      if (existingByEmail) {
        // Link OAuth provider to existing email account
        const updated = await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            ...(profile.provider === 'google'
              ? { googleId: profile.providerId }
              : { appleId: profile.providerId }),
            avatar: profile.avatar || existingByEmail.avatar,
            // OAuth email is already verified
            isEmailVerified: true,
            emailVerifiedAt: existingByEmail.emailVerifiedAt || new Date(),
          },
          include: { profile: true },
        });

        logger.info('OAuth linked to existing account', {
          userId: updated.id,
          provider: profile.provider,
        });

        return { user: updated, isNewUser: false };
      }

      // 3. Create brand new user
      const username = await this.generateUniqueUsername(
        profile.firstName || profile.displayName || profile.email.split('@')[0]
      );

      const newUser = await prisma.user.create({
        data: {
          email: profile.email,
          username,
          // Random password hash — OAuth users can't log in with password
          passwordHash: crypto.randomBytes(32).toString('hex'),
          authProvider: profile.provider,
          isEmailVerified: true,    // OAuth email is already verified
          emailVerifiedAt: new Date(),
          isProfileComplete: false, // Must complete profile after OAuth login
          avatar: profile.avatar || null,
          ...(profile.provider === 'google'
            ? { googleId: profile.providerId }
            : { appleId: profile.providerId }),
        },
        include: { profile: true },
      });

      // Initialize user stats and trust
      await prisma.userStats.create({
        data: {
          userId: newUser.id,
          requestsCount: 0,
          totalDonated: 0,
          totalReceived: 0,
          abuseFlags: 0,
        },
      });

      await prisma.userTrust.create({
        data: { userId: newUser.id, trustTier: 1 },
      });

      logger.info('New OAuth user created', {
        userId: newUser.id,
        provider: profile.provider,
        email: profile.email,
      });

      return { user: newUser, isNewUser: true };
    } catch (error: any) {
      logger.error('Failed to find or create OAuth user', { error: error.message });
      throw error;
    }
  }

  // ============================================
  // USERNAME GENERATOR
  // ============================================

  private static async generateUniqueUsername(base: string): Promise<string> {
    const cleaned = base
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 15) || 'user';

    // Try base first
    const existing = await prisma.user.findUnique({ where: { username: cleaned } });
    if (!existing) return cleaned;

    // Append random numbers until unique
    let username = '';
    let attempts = 0;
    do {
      const suffix = Math.floor(Math.random() * 9999);
      username = `${cleaned}${suffix}`;
      const taken = await prisma.user.findUnique({ where: { username } });
      if (!taken) break;
      attempts++;
    } while (attempts < 10);

    return username;
  }

  // ============================================
  // CREATE SESSION + TOKENS
  // ============================================

  static async createOAuthSession(
    user: any,
    userAgent: string,
    ipAddress: string
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tempSessionId = crypto.randomUUID();

    // Generate initial refresh token
    const tempRefreshToken = TokenService.generateRefreshToken(
      user.id,
      user.email,
      user.role,
      tempSessionId
    );

    // Create session in DB
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        userAgent,
        ipAddress,
        refreshToken: tempRefreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Generate final tokens with real session ID
    const accessToken = TokenService.generateAccessToken(
      user.id,
      user.email,
      user.role,
      session.id
    );

    const refreshToken = TokenService.generateRefreshToken(
      user.id,
      user.email,
      user.role,
      session.id
    );

    // Update session with correct refresh token
    await prisma.session.update({
      where: { id: session.id },
      data: { refreshToken },
    });

    return { accessToken, refreshToken };
  }
}
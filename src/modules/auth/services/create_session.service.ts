import crypto from 'crypto';
import { Request } from 'express';
import prisma from '../../../config/database';
import { TokenService } from './tokenService';
import { CacheService } from './cacheService';
import { IUser } from '../types/user.interface';

/**
 * Create DB session + JWT pair (same behavior as POST /api/auth/login).
 */
export async function createSessionAndTokens(
  req: Request,
  user: IUser
): Promise<{ accessToken: string; refreshToken: string }> {
  const userAgent = req.headers['user-agent'] || 'Unknown';
  const ipAddress = (
    req.ip ||
    req.socket.remoteAddress ||
    'Unknown'
  ).replace('::ffff:', '');

  const tempSessionId = crypto.randomUUID();

  const refreshToken = TokenService.generateRefreshToken(
    user.id,
    user.email,
    user.role,
    tempSessionId
  );

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      userAgent,
      ipAddress,
      refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  const accessToken = TokenService.generateAccessToken(
    user.id,
    user.email,
    user.role,
    session.id
  );

  const finalRefreshToken = TokenService.generateRefreshToken(
    user.id,
    user.email,
    user.role,
    session.id
  );

  await prisma.session.update({
    where: { id: session.id },
    data: { refreshToken: finalRefreshToken },
  });

  await CacheService.setRefreshToken(session.id, finalRefreshToken);

  await CacheService.cacheUserSession(
    user.id,
    {
      email: user.email,
      username: user.username,
      role: user.role,
      lastLogin: new Date(),
    },
    15 * 60
  );

  return { accessToken, refreshToken: finalRefreshToken };
}

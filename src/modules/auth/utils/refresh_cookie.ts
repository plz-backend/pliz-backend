import { Response } from 'express';

/** HttpOnly cookie name for web refresh token (not readable by JS). */
export const REFRESH_TOKEN_COOKIE_NAME = 'pliz_refresh';

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function cookieSecureFlag(): boolean {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

/**
 * Production + cross-origin (e.g. Vercel → Cloud Run) needs SameSite=None; Secure.
 * Local HTTP dev uses lax + insecure cookies so browsers can store them.
 */
export function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  const secure = cookieSecureFlag();
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

export function clearRefreshTokenCookie(res: Response): void {
  const secure = cookieSecureFlag();
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
  });
}

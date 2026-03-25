import { Request, Response } from 'express';

/** HttpOnly cookie name for web refresh token (not readable by JS). */
export const REFRESH_TOKEN_COOKIE_NAME = 'pliz_refresh';

/**
 * Body (JSON) or httpOnly cookie; cookie-parser may miss some proxies — also parse raw Cookie header.
 */
export function getRefreshTokenFromRequest(req: Request): string {
  const body =
    typeof req.body?.refreshToken === 'string'
      ? req.body.refreshToken.trim()
      : '';
  if (body) return body;

  const fromParser = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
  if (typeof fromParser === 'string' && fromParser.length > 0) {
    return fromParser;
  }

  const raw = req.headers.cookie;
  if (!raw || typeof raw !== 'string') return '';

  const parts = raw.split(';');
  for (const p of parts) {
    const s = p.trim();
    const eq = s.indexOf('=');
    if (eq === -1) continue;
    const k = s.slice(0, eq).trim();
    if (k !== REFRESH_TOKEN_COOKIE_NAME) continue;
    const v = s.slice(eq + 1).trim();
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  }
  return '';
}

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

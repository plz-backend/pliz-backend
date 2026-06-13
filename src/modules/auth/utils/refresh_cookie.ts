import { Request, Response } from 'express';
import crypto from 'crypto';

/** HttpOnly cookie name for web refresh token (not readable by JS). */
export const REFRESH_TOKEN_COOKIE_NAME = 'pliz_refresh';
export const CSRF_COOKIE_NAME = 'pliz_csrf';

/**
 * Body (JSON) or httpOnly cookie; cookie-parser may miss some proxies — also parse raw Cookie header.
 */
export function getRefreshTokenFromRequest(req: Request): string {
  const body =
    typeof req.body?.refreshToken === 'string'
      ? req.body.refreshToken.trim()
      : '';
  if (body) return body;

  const fromHeader = getAllCookieValuesFromRequest(req, REFRESH_TOKEN_COOKIE_NAME);
  if (fromHeader.length > 0) {
    // Prefer last value when migrating host-only → Domain=.plz.ng cookies.
    return fromHeader[fromHeader.length - 1]!;
  }

  const fromParser = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
  if (typeof fromParser === 'string' && fromParser.length > 0) {
    return fromParser;
  }

  return '';
}

export function hasBodyRefreshToken(req: Request): boolean {
  return typeof req.body?.refreshToken === 'string' && req.body.refreshToken.trim().length > 0;
}

export function hasCookieRefreshToken(req: Request): boolean {
  return Boolean(req.cookies?.[REFRESH_TOKEN_COOKIE_NAME] || req.headers.cookie?.includes(`${REFRESH_TOKEN_COOKIE_NAME}=`));
}

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function cookieSecureFlag(): boolean {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  return process.env.NODE_ENV === 'production';
}

/**
 * Shared parent domain (e.g. `.plz.ng`) so app.plz.ng JS can read `pliz_csrf` while
 * `pliz_refresh` stays httpOnly. Omit on localhost — port-only origins share `localhost`.
 */
export function cookieDomain(): string | undefined {
  const raw = process.env.COOKIE_DOMAIN?.trim();
  if (!raw) return undefined;
  return raw.startsWith('.') ? raw : `.${raw}`;
}

type CookieSameSite = 'lax' | 'none' | 'strict';

function sharedCookieOptions(): {
  secure: boolean;
  sameSite: CookieSameSite;
  path: string;
  domain?: string;
} {
  const secure = cookieSecureFlag();
  const domain = cookieDomain();
  return {
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    ...(domain ? { domain } : {}),
  };
}

/** Remove pre-COOKIE_DOMAIN host-only cookies on the API hostname (api*.plz.ng). */
function clearLegacyHostOnlyAuthCookies(res: Response): void {
  const secure = cookieSecureFlag();
  const hostOnly = {
    secure,
    sameSite: (secure ? 'none' : 'lax') as CookieSameSite,
    path: '/',
  };
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, { ...hostOnly, httpOnly: true });
  res.clearCookie(CSRF_COOKIE_NAME, { ...hostOnly, httpOnly: false });
}

function getAllCookieValuesFromRequest(req: Request, name: string): string[] {
  const raw = req.headers.cookie;
  if (!raw || typeof raw !== 'string') return [];

  const values: string[] = [];
  for (const part of raw.split(';')) {
    const segment = part.trim();
    const eq = segment.indexOf('=');
    if (eq === -1) continue;
    if (segment.slice(0, eq).trim() !== name) continue;
    const value = segment.slice(eq + 1).trim();
    try {
      values.push(decodeURIComponent(value));
    } catch {
      values.push(value);
    }
  }
  return values;
}

/**
 * Production + cross-origin (app.plz.ng → api.plz.ng) needs SameSite=None; Secure and
 * COOKIE_DOMAIN=.plz.ng so the web app can read the CSRF cookie for refresh requests.
 * Local HTTP dev uses lax + insecure cookies without domain.
 */
export function setRefreshTokenCookie(res: Response, refreshToken: string): void {
  if (cookieDomain()) {
    clearLegacyHostOnlyAuthCookies(res);
  }
  const base = sharedCookieOptions();
  const csrfToken = crypto.randomBytes(32).toString('hex');
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    ...base,
    httpOnly: true,
    maxAge: MAX_AGE_MS,
  });
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    ...base,
    httpOnly: false,
    maxAge: MAX_AGE_MS,
  });
}

export function clearRefreshTokenCookie(res: Response): void {
  if (cookieDomain()) {
    clearLegacyHostOnlyAuthCookies(res);
  }
  const base = sharedCookieOptions();
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    ...base,
    httpOnly: true,
  });
  res.clearCookie(CSRF_COOKIE_NAME, {
    ...base,
    httpOnly: false,
  });
}

export function verifyRefreshCookieCsrf(req: Request): boolean {
  if (!hasCookieRefreshToken(req)) return true;
  if (hasBodyRefreshToken(req)) return false;
  const headerToken = req.header('x-csrf-token');
  if (!headerToken) return false;

  const cookieTokens = getAllCookieValuesFromRequest(req, CSRF_COOKIE_NAME);
  if (cookieTokens.length === 0) {
    const fromParser = req.cookies?.[CSRF_COOKIE_NAME];
    return typeof fromParser === 'string' && fromParser === headerToken;
  }

  return cookieTokens.includes(headerToken);
}

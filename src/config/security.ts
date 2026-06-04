/**
 * Security Configuration
 */
export const SecurityConfig = {
  bcrypt: {
    saltRounds: 12,
  },
  jwt: {
    accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    
  },
  session: {
    expiryDays: 7, // 7 days
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  },
};

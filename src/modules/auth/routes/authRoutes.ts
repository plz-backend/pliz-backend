
import express from 'express';

// Controllers
import { signup } from '../controllers/Authentication/signup';
import { login } from '../controllers/Authentication/login';
import { logout } from '../controllers/Authentication/logout';
import { verifyEmail } from '../controllers/Authentication/verify_email';
import { forgotPassword } from '../controllers/Authentication/forget_password';
import { resetPassword } from '../controllers/Authentication/reset_password';
import { resendVerification } from '../controllers/Authentication/resend_verification';
import { logoutAll } from '../controllers/Authentication/logout_all';
import { changePassword } from '../controllers/Authentication/change_password';
import { getMe } from '../controllers/Authentication/get_me';
import { refreshToken } from '../controllers/Authentication/refresh_token';
import { invalidateRefreshCookie } from '../controllers/Authentication/invalidate_refresh_cookie';
import { createAdminUser } from '../controllers/Authentication/create_admin_user';
import { acceptAdminInvite } from '../controllers/Authentication/accept_admin_invite';
import { googleLogin, appleLogin } from '../controllers/Authentication/oauth.controller';
import { googleLoginValidation, appleLoginValidation } from '../middleware/auth/oauth.validation';


// Middleware
import { authenticate } from '../middleware/auth/auth';
import { validateRequest } from '../middleware/auth/validateRequest';
import { requireAdmin } from '../../admin/middleware/admin_auth';
import { requirePermission } from '../../admin/middleware/requirePermission';
import { AdminPermission } from '../../admin/permissions';

// Validations
import {
  signupValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  resendVerificationValidation,
  refreshTokenValidation,
  changePasswordValidation,  
} from '../middleware/auth/validation';

// Rate Limiters
import {
  authLimiter,
  generalLimiter,
} from '../middleware/auth/rateLimiter';

const router = express.Router();

const frontendBaseUrl = (): string => (
  process.env.FRONTEND_URL ||
  process.env.EXPO_PUBLIC_FRONTEND_URL ||
  'http://localhost:8081'
).replace(/\/$/, '');

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * @route   POST /api/auth/signup
 * @desc    Register new user
 * @access  Public
 */
router.post(
  '/signup',
  authLimiter,
  signupValidation,
  validateRequest,
  signup
);

/**
 * @route   POST /api/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post(
  '/login',
  authLimiter,
  loginValidation,
  validateRequest,
  login
);

/**
 * @route   POST /api/auth/refresh-token
 * @desc    Refresh access token
 * @access  Public
 */
router.post(
  '/refresh-token',
  generalLimiter,  
  refreshTokenValidation,
  validateRequest,
  refreshToken
);

/**
 * @route   POST /api/auth/invalidate-refresh-cookie
 * @desc    Revoke session from httpOnly cookie (web)
 * @access  Public
 */
router.post(
  '/invalidate-refresh-cookie',
  generalLimiter,
  invalidateRefreshCookie
);

/**
 * @route   GET /api/auth/verify-email
 * @desc    Verify email address
 * @access  Public
 */
router.get(
  '/verify-email',
  generalLimiter,
  verifyEmail
);

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend email verification link
 * @access  Public
 */
router.post(
  '/resend-verification',
  authLimiter, 
  resendVerificationValidation,
  validateRequest,
  resendVerification
);

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post(
  '/forgot-password',
  authLimiter,
  forgotPasswordValidation,
  validateRequest,
  forgotPassword
);

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with token
 * @access  Public
 */
router.get('/reset-password', (req, res) => {
  const token = typeof req.query.token === 'string' ? req.query.token.trim() : '';
  const redirectUrl = token
    ? `${frontendBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`
    : `${frontendBaseUrl()}/forgot-password`;
  res.redirect(302, redirectUrl);
});

router.post(
  '/reset-password',
  authLimiter,
  resetPasswordValidation,
  validateRequest,
  resetPassword
);

// ============================================
// AUTHENTICATED ROUTES (PRIVATE)
// ============================================

/**
 * @route   GET /api/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get(
  '/me',
  authenticate,
  generalLimiter,
  getMe
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout current session
 * @access  Private
 */
router.post(
  '/logout',
  authenticate,
  generalLimiter,  
  logout
);

/**
 * @route   POST /api/auth/logout-all
 * @desc    Logout all sessions
 * @access  Private
 */
router.post(
  '/logout-all',
  authenticate,
  authLimiter, 
  logoutAll
);

/**
 * @route   POST /api/auth/change-password
 * @desc    Change password (requires current password)
 * @access  Private
 */
router.post(
  '/change-password',
  authenticate,
  authLimiter,  
  changePasswordValidation,  
  validateRequest,
  changePassword
);

// ============================================
// OAUTH ROUTES (PUBLIC)
// ============================================ 
// POST /api/auth/google
router.post('/google', authLimiter, googleLoginValidation, validateRequest, googleLogin);

// POST /api/auth/apple
router.post('/apple', authLimiter, appleLoginValidation, validateRequest, appleLogin);

// ============================================
// ADMIN TEAM INVITE (PUBLIC)
// ============================================
router.post('/admin/accept-invite', authLimiter, acceptAdminInvite);

// ============================================
// ADMIN ROUTES (PROTECTED)
// ============================================

/**
 * @deprecated Prefer POST /api/admin/team/invite — kept for super admin tooling
 */
router.post(
  '/admin/create-user',
  authenticate,
  requireAdmin,
  requirePermission(AdminPermission.TEAM_MANAGE),
  authLimiter,
  createAdminUser
);

export default router;

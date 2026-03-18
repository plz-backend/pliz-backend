
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
import { createAdminUser } from '../controllers/Authentication/create_admin_user';

// Middleware
import { authenticate } from '../middleware/auth/auth';
import { validateRequest } from '../middleware/auth/validateRequest';
import { requireAdmin } from '../../admin/middleware/admin_auth';

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
// ADMIN ROUTES (PROTECTED)
// ============================================

/**
 * @route   POST /api/auth/admin/create-user
 * @desc    Create admin or superadmin user
 * @access  Admin/SuperAdmin only
 */
router.post(
  '/admin/create-user',
  authenticate,
  requireAdmin,
  authLimiter,  
  createAdminUser
);

export default router;
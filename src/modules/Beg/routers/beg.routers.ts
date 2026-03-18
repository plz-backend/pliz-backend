

import { Router } from 'express';
import { authenticate } from '../../auth/middleware/auth/auth';
import { checkAccountStatus } from '../../auth/middleware/auth/account_status.middleware.js';  
import { checkProfileComplete } from '../../auth/middleware/auth/check_profile_complete.js'; 
import { checkCooldown } from '../middleware/check_cooldown';
import { generalLimiter } from '../../auth/middleware/auth/rateLimiter.js';
import { validateRequest } from '../../auth/middleware/auth/validateRequest';

// Validations
import {
  createBegValidation,
  getBegsFeedValidation,
  getBegByIdValidation,
} from '../middleware/beg.validation';

// Controllers
import { createBeg } from '../../Beg/controller/beg.controller.create_beg.ts';
import { getBegs } from '../../Beg/controller/beg.controller.get_begs.js';             // Public feed
import { getBegById } from '../../Beg/controller/beg.controller.get_beg_by_id';      // Single beg
import { getMyBegs } from '../../Beg/controller/beg.controller.get_my_begs';        // User's own begs
import { updateBeg } from '../../Beg/controller/beg.update_beg.js';
import { cancelBeg } from '../../Beg/controller/beg.controller.cancel_beg';
import { getCategories } from '../../Beg/controller/beg.get_categories.js';
import { getTrustProgress} from '../../Beg/controller/beg.get_trust_progress.js';

const router = Router();

// ============================================
// CRITICAL: SPECIFIC ROUTES MUST COME FIRST!
// ============================================
// If /:id comes before these, Express will treat
// "categories", "my-begs", "trust" as ID parameters!

/**
 * @route   GET /api/begs/categories
 * @desc    Get all active categories
 * @access  Public
 */
router.get('/categories', generalLimiter, getCategories);

/**
 * @route   GET /api/begs/my-begs
 * @desc    Get current user's begs
 * @access  Private
 */
router.get('/my-begs', authenticate, getMyBegs);

/**
 * @route   GET /api/begs/trust/progress
 * @desc    Get user's trust tier progress
 * @access  Private
 */
router.get('/trust/progress', authenticate, getTrustProgress);

// ============================================
// PUBLIC ROUTES (GENERIC - COME AFTER SPECIFIC)
// ============================================

/**
 * @route   GET /api/begs
 * @desc    Get active begs (feed)
 * @access  Public
 */
router.get(
  '/',
  generalLimiter,
  getBegsFeedValidation,
  validateRequest,
  getBegs
);

/**
 * @route   GET /api/begs/:id
 * @desc    Get single beg by ID
 * @access  Public
 */
router.get(
  '/:id',
  generalLimiter,
  getBegByIdValidation,
  validateRequest,
  getBegById
);

// ============================================
// PRIVATE ROUTES (REQUIRE AUTHENTICATION)
// ============================================

/**
 * @route   POST /api/begs
 * @desc    Create a new beg
 * @access  Private
 */
router.post(
  '/',
  authenticate,
  checkProfileComplete,
  checkCooldown,
  createBegValidation,
  checkAccountStatus,
  validateRequest,
  createBeg
);

/**
 * @route   PUT /api/begs/:id
 * @desc    Update a beg
 * @access  Private
 */
router.put(
  '/:id',
  authenticate,
  checkAccountStatus,
  updateBeg
);

/**
 * @route   DELETE /api/begs/:id
 * @desc    Cancel user's own beg
 * @access  Private
 */
router.delete(
  '/:id',
  authenticate,
  getBegByIdValidation,
  validateRequest,
  cancelBeg
);

export default router;
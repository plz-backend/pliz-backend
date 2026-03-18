import express from 'express';
import { completeProfile } from '../../auth/controllers/profile/auth.controller.complete_profile';
import { updateProfile } from '../../auth/controllers/profile/auth.controller.update_profile';
import { getProfile } from '../../auth/controllers/profile/auth.controller.get_profile';
import { authenticate } from '../middleware/auth/auth';
import { validateRequest } from '../middleware/auth/validateRequest';
import {
  completeProfileValidation,
  updateProfileValidation,
} from '../middleware/auth/middleware.profile.validation';

const router = express.Router();

/**
 * @route   GET /api/auth/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/', authenticate, getProfile);

/**
 * @route   POST /api/auth/profile/complete
 * @desc    Complete user profile (first time)
 * @access  Private
 */
router.post(
  '/complete',
  authenticate,
  completeProfileValidation,
  validateRequest,
  completeProfile
);

/**
 * @route   PUT /api/auth/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put(
  '/',
  authenticate,
  updateProfileValidation,
  validateRequest,
  updateProfile
);

export default router;
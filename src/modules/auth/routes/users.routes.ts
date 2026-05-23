import express from 'express';
import { authenticate } from '../middleware/auth/auth';
import { getPublicProfile } from '../controllers/profile/auth.controller.get_public_profile';

const router = express.Router();

/**
 * @route   GET /api/users/:userId/public-profile
 * @desc    View another member's public profile
 * @access  Private
 */
router.get('/:userId/public-profile', authenticate, getPublicProfile);

export default router;

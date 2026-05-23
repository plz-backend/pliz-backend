import { Router } from 'express';
import { authenticate } from '../../auth/middleware/auth/auth';
import { validateRequest } from '../../auth/middleware/auth/validateRequest';
import { addReaction } from '../controllers/add-reaction.controller';
import { getReactions } from '../controllers/get-reactions.controller';
import { getAvailableEmojis } from '../controllers/get-emojis.controller';
import { reactionLimiter } from '../../auth/middleware/auth/rateLimiter';
import {
  addReactionValidation,
  getReactionsValidation,
} from '../validations/reaction.validation';

const router = Router();

// GET /api/reactions/emojis — must be BEFORE /:targetType/:targetId
router.get('/emojis', authenticate, getAvailableEmojis);

// GET /api/reactions/:targetType/:targetId
router.get(
  '/:targetType/:targetId',
  authenticate,
  getReactionsValidation,
  validateRequest,
  getReactions
);

// POST /api/reactions
router.post(
  '/',
  authenticate,
  reactionLimiter,
  addReactionValidation,
  validateRequest,
  addReaction
);

export default router;
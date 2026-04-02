import { Router } from 'express';
import { authenticate } from '../../auth/middleware/auth/auth';
import { checkAccountStatus } from '../../auth/middleware/auth/account_status.middleware';
import { validateRequest } from '../../auth/middleware/auth/validateRequest';
import {
  getStories,
  getMyStories,
  createStory,
  updateStory,
  deleteStory,
} from '../controllers/story.controller';
import {
  createStoryValidation,
  updateStoryValidation,
  storyIdValidation,
} from '../validations/story.validation';

const router = Router();

// Public-ish (authenticated)
router.get('/', authenticate, getStories);
router.get('/my-stories', authenticate, getMyStories);

// Requires active account
router.post('/', authenticate, checkAccountStatus, createStoryValidation, validateRequest, createStory);
router.put('/:id', authenticate, checkAccountStatus, updateStoryValidation, validateRequest, updateStory);
router.delete('/:id', authenticate, storyIdValidation, validateRequest, deleteStory);

export default router;
import { Router } from 'express';
import { authenticate } from '../../auth/middleware/auth/auth';
import { validateRequest } from '../../auth/middleware/auth/validateRequest';
import { handleUpload } from '../middleware/upload.middleware';
import { uploadPicture } from '../controllers/upload-picture.controller';
import { removePicture } from '../controllers/remove-picture.controller';
import {
  setInitialsAvatar,
  setLibraryAvatar,
} from '../controllers/set-avatar.controller';
import {
  getAvatar,
  getAvatarOptions,
} from '../controllers/get-avatar.controller';
import {
  setInitialsAvatarValidation,
  setLibraryAvatarValidation,
} from '../validations/profile-picture.validation';

const router = Router();

// GET  /api/profile-picture
router.get('/', authenticate, getAvatar);

// GET  /api/profile-picture/options
router.get('/options', authenticate, getAvatarOptions);

// POST /api/profile-picture/upload
router.post('/upload', authenticate, handleUpload, uploadPicture);

// DELETE /api/profile-picture
router.delete('/', authenticate, removePicture);

// POST /api/profile-picture/avatar/initials
router.post(
  '/avatar/initials',
  authenticate,
  setInitialsAvatarValidation,
  validateRequest,
  setInitialsAvatar
);

// POST /api/profile-picture/avatar/library
router.post(
  '/avatar/library',
  authenticate,
  setLibraryAvatarValidation,
  validateRequest,
  setLibraryAvatar
);

export default router;
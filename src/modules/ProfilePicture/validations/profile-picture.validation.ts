import { body } from 'express-validator';
import { AVATAR_COLORS, LIBRARY_AVATARS } from '../types/profile-picture.interface';

export const setInitialsAvatarValidation = [
  body('color')
    .notEmpty()
    .withMessage('Color is required')
    .isIn([...AVATAR_COLORS])
    .withMessage('Invalid color. Please select from the available colors.'),
];

export const setLibraryAvatarValidation = [
  body('avatarId')
    .notEmpty()
    .withMessage('Avatar ID is required')
    .isIn(LIBRARY_AVATARS.map(a => a.id))
    .withMessage('Invalid avatar. Please select from the available avatars.'),
];
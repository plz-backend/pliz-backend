import { body, param } from 'express-validator';

const MAX_STORY_WORDS = 60;
const MAX_STORY_LENGTH = 500;

const contentValidation = (field = 'content') =>
  body(field)
    .notEmpty()
    .withMessage('Story content is required')
    .isString()
    .withMessage('Content must be a string')
    .trim()
    .isLength({ min: 10 })
    .withMessage('Story must be at least 10 characters')
    .isLength({ max: MAX_STORY_LENGTH })
    .withMessage(`Story cannot exceed ${MAX_STORY_LENGTH} characters`)
    .custom((value: string) => {
      const wordCount = value.trim().split(/\s+/).filter(w => w.length > 0).length;
      if (wordCount > MAX_STORY_WORDS) {
        throw new Error(`Story cannot exceed ${MAX_STORY_WORDS} words (currently ${wordCount} words)`);
      }
      return true;
    });

const storyIdParam = param('id')
  .notEmpty()
  .withMessage('Story ID is required')
  .isUUID()
  .withMessage('Invalid story ID format');

export const createStoryValidation = [contentValidation()];

export const updateStoryValidation = [storyIdParam, contentValidation()];

export const storyIdValidation = [storyIdParam];

export const rejectStoryValidation = [
  storyIdParam,
  body('reason')
    .notEmpty()
    .withMessage('Rejection reason is required')
    .isString()
    .withMessage('Reason must be a string')
    .trim()
    .isLength({ min: 5 })
    .withMessage('Reason must be at least 5 characters')
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters'),
];
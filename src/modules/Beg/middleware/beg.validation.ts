import { body, query, param } from 'express-validator';
import { MAX_TITLE_CHARS, MAX_TITLE_WORDS } from '../../../config/trust_tiers';

/**
 * Validation for creating a beg
 */
export const createBegValidation = [
  body('title')
    .optional()
    .isString()
    .withMessage('Title must be a string')
    .trim()
    .isLength({ max: MAX_TITLE_CHARS })
    .withMessage(`Title cannot exceed ${MAX_TITLE_CHARS} characters`)
    .custom((value) => {
      const wordCount = value.trim().split(/\s+/).length;
      if (wordCount > MAX_TITLE_WORDS) {
        throw new Error(`Title cannot exceed ${MAX_TITLE_WORDS} words`);
      }
      return true;
    }),

  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn(['food', 'transport', 'rent', 'medical', 'education', 'emergency', 'other'])
    .withMessage('Invalid category'),

  body('amountRequested')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 100, max: 250000 })
    .withMessage('Amount must be between ₦100 and ₦250,000')
    .toFloat(),

  body('mediaType')
    .optional()
    .isIn(['video', 'audio', 'text'])
    .withMessage('Invalid media type'),

  body('mediaUrl')
    .optional()
    .isURL()
    .withMessage('Invalid media URL'),
];

/**
 * Validation for getting begs (feed)
 * Accepts BOTH category (name) OR categoryId (UUID)
 */
export const getBegsFeedValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer')
    .toInt(),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100')
    .toInt(),

  query('category')
    .optional()
    .isIn(['food', 'transport', 'rent', 'medical', 'education', 'emergency', 'other'])
    .withMessage('Invalid category'),

  query('categoryId')
    .optional()
    .isUUID()
    .withMessage('Invalid category ID format'),
];

/**
 * Validation for getting single beg
 */
export const getBegByIdValidation = [
  param('id')
    .notEmpty()
    .withMessage('Beg ID is required')
    .isUUID()
    .withMessage('Invalid beg ID format'),
];

/**
 * Validation for updating beg status
 */
export const updateBegStatusValidation = [
  param('id')
    .notEmpty()
    .withMessage('Beg ID is required')
    .isUUID()
    .withMessage('Invalid beg ID format'),

  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['active', 'funded', 'expired', 'cancelled', 'flagged'])
    .withMessage('Invalid status'),
];
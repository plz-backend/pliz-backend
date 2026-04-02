import { body, query, param } from 'express-validator';

/**
 * Validation for creating a beg
 */
export const createBegValidation = [
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn(['food', 'transport', 'rent', 'medical', 'education', 'emergency', 'other'])
    .withMessage('Invalid category'),

  body('description')
    .optional({ nullable: true })
    .isString()
    .withMessage('Description must be a string')
    .trim()
    .isLength({ max: 300 })
    .withMessage('Description cannot exceed 300 characters')
    .custom((value) => {
      if (!value) return true;
      const wordCount = value.trim().split(/\s+/).filter((w: string) => w.length > 0).length;
      if (wordCount > 40) {
        throw new Error('Description cannot exceed 40 words');
      }
      return true;
    }),

  body('amountRequested')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 100, max: 250000 })
    .withMessage('Amount must be between ₦100 and ₦250,000')
    .toFloat(),

  body('expiryHours')
    .optional()
    .isInt()
    .withMessage('Expiry hours must be a number')
    .isIn([24, 72, 168])
    .withMessage('Expiry must be 24 hours, 72 hours, or 7 days (168 hours)')
    .toInt(),

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


/**
 * extend beg status
 */
export const extendBegValidation = [
  param('id')
    .notEmpty()
    .withMessage('Beg ID is required')
    .isUUID()
    .withMessage('Invalid beg ID format'),

  body('expiryHours')
    .notEmpty()
    .withMessage('Please select an expiry option')
    .isInt()
    .withMessage('Expiry hours must be a number')
    .isIn([24, 72, 168])
    .withMessage('Expiry must be 24 hours, 72 hours, or 7 days (168 hours)')
    .toInt(),
];
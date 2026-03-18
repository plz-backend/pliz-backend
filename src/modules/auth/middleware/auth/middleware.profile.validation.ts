import { body } from 'express-validator';

/**
 * Validation for completing profile
 */
export const completeProfileValidation = [
  body('firstName')
    .notEmpty()
    .withMessage('First name is required')
    .isString()
    .withMessage('First name must be a string')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('First name must be between 2 and 100 characters'),

  body('middleName')
    .optional()
    .isString()
    .withMessage('Middle name must be a string')
    .trim()
    .isLength({ max: 100 })
    .withMessage('Middle name cannot exceed 100 characters'),

  body('lastName')
    .notEmpty()
    .withMessage('Last name is required')
    .isString()
    .withMessage('Last name must be a string')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Last name must be between 2 and 100 characters'),

  body('phoneNumber')
    .notEmpty()
    .withMessage('Phone number is required')
    .isString()
    .withMessage('Phone number must be a string')
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Phone number must be in E.164 format (e.g., +2348012345678)'),

  body('agreeToTerms')
    .notEmpty()
    .withMessage('You must agree to terms and conditions')
    .isBoolean()
    .withMessage('Agree to terms must be true or false')
    .equals('true')
    .withMessage('You must agree to terms and conditions'),

  body('displayName')
    .optional()
    .isString()
    .withMessage('Display name must be a string')
    .trim()
    .isLength({ max: 150 })
    .withMessage('Display name cannot exceed 150 characters'),

  body('isAnonymous')
    .optional()
    .isBoolean()
    .withMessage('isAnonymous must be true or false'),
];

/**
 * Validation for updating profile
 */
export const updateProfileValidation = [
  body('firstName')
    .optional()
    .isString()
    .withMessage('First name must be a string')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('First name must be between 2 and 100 characters'),

  body('middleName')
    .optional()
    .isString()
    .withMessage('Middle name must be a string')
    .trim()
    .isLength({ max: 100 })
    .withMessage('Middle name cannot exceed 100 characters'),

  body('lastName')
    .optional()
    .isString()
    .withMessage('Last name must be a string')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Last name must be between 2 and 100 characters'),

  body('phoneNumber')
    .optional()
    .isString()
    .withMessage('Phone number must be a string')
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Phone number must be in E.164 format (e.g., +2348012345678)'),

  body('displayName')
    .optional()
    .isString()
    .withMessage('Display name must be a string')
    .trim()
    .isLength({ max: 150 })
    .withMessage('Display name cannot exceed 150 characters'),

  body('isAnonymous')
    .optional()
    .isBoolean()
    .withMessage('isAnonymous must be true or false'),
];
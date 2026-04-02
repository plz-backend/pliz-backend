import { body } from 'express-validator';

export const googleLoginValidation = [
  body('idToken')
    .notEmpty()
    .withMessage('Google ID token is required')
    .isString()
    .withMessage('Invalid token format'),
];

export const appleLoginValidation = [
  body('idToken')
    .notEmpty()
    .withMessage('Apple ID token is required')
    .isString()
    .withMessage('Invalid token format'),

  body('firstName')
    .optional()
    .isString()
    .withMessage('First name must be a string')
    .trim()
    .isLength({ max: 100 })
    .withMessage('First name too long'),

  body('lastName')
    .optional()
    .isString()
    .withMessage('Last name must be a string')
    .trim()
    .isLength({ max: 100 })
    .withMessage('Last name too long'),
];
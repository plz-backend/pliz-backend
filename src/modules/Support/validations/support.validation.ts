import { body } from 'express-validator';

export const aiChatValidation = [
  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message must be between 1 and 1000 characters'),

  body('sessionId')
    .optional()
    .isString()
    .withMessage('Session ID must be a string'),
];

export const escalateValidation = [
  body('sessionId')
    .notEmpty()
    .withMessage('Session ID is required'),

  body('subject')
    .notEmpty()
    .withMessage('Subject is required')
    .isLength({ max: 255 })
    .withMessage('Subject cannot exceed 255 characters'),

  body('category')
    .optional()
    .isIn(['account', 'payment', 'beg', 'donation', 'kyc', 'technical', 'other'])
    .withMessage('Invalid category'),

  body('contactEmail')
    .notEmpty()
    .withMessage('Contact email is required')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),
];

export const createTicketValidation = [
  body('subject')
    .notEmpty()
    .withMessage('Subject is required')
    .isLength({ max: 255 })
    .withMessage('Subject cannot exceed 255 characters'),

  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isIn(['account', 'payment', 'beg', 'donation', 'kyc', 'technical', 'other'])
    .withMessage('Invalid category. Must be: account, payment, beg, donation, kyc, technical, or other'),

  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 10 })
    .withMessage('Please provide more details (minimum 10 characters)'),

  body('contactEmail')
    .notEmpty()
    .withMessage('Contact email is required')
    .isEmail()
    .withMessage('Please enter a valid email address')
    .normalizeEmail(),
];

export const replyTicketValidation = [
  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 1 })
    .withMessage('Message cannot be empty'),
];

export const adminReplyValidation = [
  body('message')
    .notEmpty()
    .withMessage('Message is required'),
];

export const updateStatusValidation = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['open', 'in_progress', 'waiting_user', 'resolved', 'closed'])
    .withMessage('Invalid status'),
];
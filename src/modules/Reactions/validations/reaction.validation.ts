import { body, param } from 'express-validator';

export const addReactionValidation = [
  body('emoji')
    .notEmpty()
    .withMessage('Emoji is required')
    .isString()
    .withMessage('Emoji must be a string')
    .isLength({ max: 10 })
    .withMessage('Invalid emoji'),

  body('targetType')
    .notEmpty()
    .withMessage('targetType is required')
    .isIn(['beg', 'donation'])
    .withMessage('targetType must be beg or donation'),

  body('targetId')
    .notEmpty()
    .withMessage('targetId is required')
    .isUUID()
    .withMessage('targetId must be a valid UUID'),
];

export const getReactionsValidation = [
  param('targetType')
    .isIn(['beg', 'donation'])
    .withMessage('targetType must be beg or donation'),

  param('targetId')
    .isUUID()
    .withMessage('targetId must be a valid UUID'),
];
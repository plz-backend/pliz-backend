import { body } from 'express-validator';

const pinRule = (field: string, label: string) =>
  body(field)
    .isString()
    .withMessage(`${label} is required`)
    .matches(/^\d{4}$/)
    .withMessage(`${label} must be exactly 4 digits`);

export const setupTransactionPinValidation = [pinRule('pin', 'PIN')];

export const verifyTransactionPinValidation = [pinRule('pin', 'PIN')];

export const changeTransactionPinValidation = [
  pinRule('currentPin', 'Current PIN'),
  pinRule('newPin', 'New PIN'),
];

import { body } from 'express-validator';


// ============================================
// SEND OTP
// ============================================
export const sendOTPValidation = [
  body('channel')
    .optional()
    .isIn(['sms', 'whatsapp'])
    .withMessage('Channel must be sms or whatsapp'),
];

export const verifyOTPValidation = [
  body('otp')
    .notEmpty()
    .withMessage('OTP is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be exactly 6 digits')
    .isNumeric()
    .withMessage('OTP must contain only numbers'),
];

const kycBodyValidation = [
  body('verificationType')
    .notEmpty()
    .withMessage('Verification type is required')
    .equals('nin')
    .withMessage('Verification type must be nin'),

  body('nin')
    .notEmpty()
    .withMessage('NIN or Virtual NIN is required')
    .custom((value) => {
      const trimmed = String(value).trim();
      if (/^\d{11}$/.test(trimmed.replace(/\D/g, ''))) return true;
      if (/^[A-Za-z0-9]{16}$/.test(trimmed.replace(/\s/g, ''))) return true;
      throw new Error(
        'Enter a valid 11-digit NIN or 16-character Virtual NIN (vNIN)'
      );
    }),

  body('ninDocumentType')
    .notEmpty()
    .withMessage('Please select your NIN document type')
    .isIn(['slip', 'card'])
    .withMessage('NIN document type must be slip or card'),

  body('ninFrontUrl')
    .notEmpty()
    .withMessage('Please scan the front of your NIN document')
    .isURL()
    .withMessage('NIN front scan must be a valid URL'),

  body('ninBackUrl')
    .if((req: any) =>
      req.body.verificationType === 'nin' &&
      req.body.ninDocumentType === 'card'
    )
    .notEmpty()
    .withMessage('Please scan the back of your NIN card')
    .isURL()
    .withMessage('NIN back scan must be a valid URL'),
];

// ============================================
// ADMIN
// ============================================
export const manuallyVerifyValidation = [
  body('note')
    .optional()
    .isString()
    .withMessage('Note must be a string')
    .isLength({ max: 500 })
    .withMessage('Note cannot exceed 500 characters'),
];

export const manuallyRejectValidation = [
  body('reason')
    .notEmpty()
    .withMessage('Rejection reason is required')
    .isString()
    .withMessage('Reason must be a string')
    .isLength({ min: 10, max: 500 })
    .withMessage('Reason must be between 10 and 500 characters'),
];

export const submitKYCValidation = kycBodyValidation;
export const updateKYCValidation = kycBodyValidation;

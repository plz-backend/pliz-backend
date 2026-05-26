import { body } from 'express-validator';


// ============================================
// SEND OTP
// ============================================
export const sendOTPValidation: ReturnType<typeof body>[] = [];

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
    .isIn(['bvn', 'nin', 'passport'])
    .withMessage('Verification type must be bvn, nin, or passport'),

  // ============================================
  // NIN — number + scan
  // ============================================
  body('nin')
    .if(body('verificationType').equals('nin'))
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
    .if(body('verificationType').equals('nin'))
    .notEmpty()
    .withMessage('Please select your NIN document type')
    .isIn(['slip', 'card'])
    .withMessage('NIN document type must be slip or card'),

  body('ninFrontUrl')
    .if(body('verificationType').equals('nin'))
    .notEmpty()
    .withMessage('Please scan the front of your NIN document')  // ← scan
    .isURL()
    .withMessage('NIN front scan must be a valid URL'),

  body('ninBackUrl')
    .if((req: any) =>
      req.body.verificationType === 'nin' &&
      req.body.ninDocumentType === 'card'
    )
    .notEmpty()
    .withMessage('Please scan the back of your NIN card')        // ← scan
    .isURL()
    .withMessage('NIN back scan must be a valid URL'),

  // ============================================
  // PASSPORT — biodata page scan only
  // ============================================
  body('passportNumber')
    .if(body('verificationType').equals('passport'))
    .notEmpty()
    .withMessage('Passport number is required')
    .isString()
    .trim(),

  body('passportExpiry')
    .if(body('verificationType').equals('passport'))
    .notEmpty()
    .withMessage('Passport expiry date is required')
    .isISO8601()
    .withMessage('Passport expiry must be a valid date e.g. 2027-06-15')
    .custom((value) => {
      if (new Date(value) < new Date()) {
        throw new Error('Your passport has expired. Please use BVN or NIN instead.');
      }
      return true;
    }),

  body('passportBiodataUrl')
    .if(body('verificationType').equals('passport'))
    .notEmpty()
    .withMessage('Please scan your passport biodata page')       // ← scan
    .isURL()
    .withMessage('Passport biodata scan must be a valid URL'),
];

// ============================================
// FACE LIVENESS
// ============================================
export const faceLivenessValidation = [
  body('image')
    .notEmpty()
    .withMessage('Selfie image is required')
    .isString()
    .withMessage('Image must be a base64 string'),
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

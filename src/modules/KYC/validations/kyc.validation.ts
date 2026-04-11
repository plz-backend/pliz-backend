import { body } from 'express-validator';

export const verifyOTPValidation = [
  body('otp')
    .notEmpty()
    .withMessage('OTP is required')
    .matches(/^\d{6}$/)
    .withMessage('OTP must be exactly 6 digits'),
];

const kycBodyValidation = [
  body('verificationType')
    .notEmpty()
    .withMessage('Verification type is required')
    .isIn(['bvn', 'nin', 'passport'])
    .withMessage('Verification type must be bvn, nin, or passport'),

  // ============================================
  // BVN — number only, no scan needed
  // ============================================
  body('bvn')
    .if(body('verificationType').equals('bvn'))
    .notEmpty()
    .withMessage('BVN is required')
    .matches(/^\d{11}$/)
    .withMessage('BVN must be exactly 11 digits'),

  // ============================================
  // NIN — number + scan
  // ============================================
  body('nin')
    .if(body('verificationType').equals('nin'))
    .notEmpty()
    .withMessage('NIN is required')
    .matches(/^\d{11}$/)
    .withMessage('NIN must be exactly 11 digits'),

  body('ninDocumentType')
    .if(body('verificationType').equals('nin'))
    .notEmpty()
    .withMessage('Please select your NIN document type')
    .isIn(['slip', 'id_card'])
    .withMessage('NIN document type must be slip or id_card'),

  body('ninFrontUrl')
    .if(body('verificationType').equals('nin'))
    .notEmpty()
    .withMessage('Please scan the front of your NIN document')  // ← scan
    .isURL()
    .withMessage('NIN front scan must be a valid URL'),

  body('ninBackUrl')
    .if((req: any) =>
      req.body.verificationType === 'nin' &&
      req.body.ninDocumentType === 'id_card'
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

export const submitKYCValidation = kycBodyValidation;
export const updateKYCValidation = kycBodyValidation;
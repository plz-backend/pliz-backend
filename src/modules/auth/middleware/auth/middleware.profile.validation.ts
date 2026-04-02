import { body } from 'express-validator';

// Nigerian states list for validation
const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa',
  'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti',
  'Enugu', 'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina',
  'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo',
  'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
];

/**
 * Validation for completing profile
 */
export const completeProfileValidation = [

  // ============================================
  // STEP 1: PERSONAL IDENTITY
  // ============================================
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

  body('displayName')
    .optional()
    .isString()
    .withMessage('Display name must be a string')
    .trim()
    .isLength({ max: 150 })
    .withMessage('Display name cannot exceed 150 characters'),

  body('dateOfBirth')
    .notEmpty()
    .withMessage('Date of birth is required')
    .isISO8601()
    .withMessage('Date of birth must be a valid date (e.g. 1993-05-15)')
    .custom((value) => {
      const dob = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      if (age < 18) throw new Error('You must be at least 18 years old');
      if (age > 100) throw new Error('Invalid date of birth');
      return true;
    }),

  body('gender')
    .notEmpty()
    .withMessage('Gender is required')
    .isIn(['male', 'female'])
    .withMessage('Gender must be either male or female'),

  // ============================================
  // STEP 2: CONTACT
  // ============================================
  body('phoneNumber')
    .notEmpty()
    .withMessage('Phone number is required')
    .isString()
    .withMessage('Phone number must be a string')
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Phone number must be in E.164 format (e.g., +2348012345678)'),

  // ============================================
  // STEP 3: LOCATION
  // ============================================
  body('state')
    .notEmpty()
    .withMessage('State is required')
    .isIn(NIGERIAN_STATES)
    .withMessage('Please select a valid Nigerian state'),

  body('city')
    .notEmpty()
    .withMessage('City is required')
    .isString()
    .withMessage('City must be a string')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('City must be between 2 and 100 characters'),

  body('address')
    .optional()
    .isString()
    .withMessage('Address must be a string')
    .trim()
    .isLength({ max: 255 })
    .withMessage('Address cannot exceed 255 characters'),

  // ============================================
  // STEP 4: PRIVACY
  // ============================================
  body('isAnonymous')
    .optional()
    .isBoolean()
    .withMessage('isAnonymous must be true or false'),

  // ============================================
  // STEP 5: LEGAL
  // ============================================
  body('agreeToTerms')
    .notEmpty()
    .withMessage('You must agree to terms and conditions')
    .isBoolean()
    .withMessage('Agree to terms must be true or false')
    .custom((value) => {
      if (value !== true) throw new Error('You must agree to terms and conditions');
      return true;
    }),
];

/**
 * Validation for updating profile
 */
export const updateProfileValidation = [

  // ============================================
  // PERSONAL IDENTITY
  // ============================================
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

  body('displayName')
    .optional()
    .isString()
    .withMessage('Display name must be a string')
    .trim()
    .isLength({ max: 150 })
    .withMessage('Display name cannot exceed 150 characters'),

  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Date of birth must be a valid date (e.g. 1993-05-15)')
    .custom((value) => {
      const dob = new Date(value);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      if (age < 18) throw new Error('You must be at least 18 years old');
      if (age > 100) throw new Error('Invalid date of birth');
      return true;
    }),

  body('gender')
    .optional()
    .isIn(['male', 'female'])
    .withMessage('Gender must be either male or female'),

  // ============================================
  // CONTACT
  // ============================================
  body('phoneNumber')
    .optional()
    .isString()
    .withMessage('Phone number must be a string')
    .matches(/^\+?[1-9]\d{1,14}$/)
    .withMessage('Phone number must be in E.164 format (e.g., +2348012345678)'),

  // ============================================
  // LOCATION
  // ============================================
  body('state')
    .optional()
    .isIn(NIGERIAN_STATES)
    .withMessage('Please select a valid Nigerian state'),

  body('city')
    .optional()
    .isString()
    .withMessage('City must be a string')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('City must be between 2 and 100 characters'),

  body('address')
    .optional()
    .isString()
    .withMessage('Address must be a string')
    .trim()
    .isLength({ max: 255 })
    .withMessage('Address cannot exceed 255 characters'),

  // ============================================
  // PRIVACY
  // ============================================
  body('isAnonymous')
    .optional()
    .isBoolean()
    .withMessage('isAnonymous must be true or false'),
];
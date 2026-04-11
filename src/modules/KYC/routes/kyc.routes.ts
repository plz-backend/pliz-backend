import { Router } from 'express';
import { authenticate } from '../../auth/middleware/auth/auth';
import { checkAccountStatus } from '../../auth/middleware/auth/account_status.middleware';
import { validateRequest } from '../../auth/middleware/auth/validateRequest';
import { getKYCStatus } from '../controllers/get-kyc-status.controller';
import { sendPhoneOTP } from '../controllers/send-phone-otp.controller';
import { resendPhoneOTP } from '../controllers/resend-phone-otp.controller';
import { verifyPhoneOTP } from '../controllers/verify-phone-otp.controller';
import { submitKYC } from '../controllers/submit-kyc.controller';
import { updateKYC } from '../controllers/update-kyc.controller';
import {
  verifyOTPValidation,
  submitKYCValidation,
  updateKYCValidation,
} from '../validations/kyc.validation';

const router = Router();

// GET  /api/kyc/status
router.get('/status', authenticate, getKYCStatus);

// POST /api/kyc/phone/send-otp
router.post('/phone/send-otp', authenticate, checkAccountStatus, sendPhoneOTP);

// POST /api/kyc/phone/resend-otp
router.post('/phone/resend-otp', authenticate, checkAccountStatus, resendPhoneOTP);

// POST /api/kyc/phone/verify-otp
router.post('/phone/verify-otp', authenticate, checkAccountStatus, verifyOTPValidation, validateRequest, verifyPhoneOTP);

// POST /api/kyc/submit
router.post('/submit', authenticate, checkAccountStatus, submitKYCValidation, validateRequest, submitKYC);

// PUT  /api/kyc/update
router.put('/update', authenticate, checkAccountStatus, updateKYCValidation, validateRequest, updateKYC);

export default router;
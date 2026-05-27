import { Router } from 'express';
import { authenticate } from '../../auth/middleware/auth/auth';
import { checkAccountStatus } from '../../auth/middleware/auth/account_status.middleware';
import { validateRequest } from '../../auth/middleware/auth/validateRequest';
import { getKYCStatus } from '../controllers/get-kyc-status.controller';
import { sendOTP } from '../controllers/send-otp.controller';
import { resendOTP } from '../controllers/resend-otp.controller';
import { verifyOTP } from '../controllers/verify-otp.controller';
import { getPhoneStatus } from '../controllers/get-phone-status.controller';
import { submitKYC } from '../controllers/submit-kyc.controller';
import { updateKYC } from '../controllers/update-kyc.controller';
import {
  sendOTPValidation,
  verifyOTPValidation,
} from '../validations/kyc.validation';
import {
  otpLimiter,
  kycUploadLimiter,
  strictLimiter,
} from '../../auth/middleware/auth/rateLimiter';
import { handleKYCUpload } from '../middleware/kyc-upload.middleware';
import { uploadDocument } from '../controllers/upload-document.controller';

const router = Router();

router.get('/status', authenticate, getKYCStatus);

router.post('/phone/send-otp', authenticate, checkAccountStatus, otpLimiter, sendOTP);

router.post(
  '/phone/resend-otp',
  authenticate,
  sendOTPValidation,
  checkAccountStatus,
  otpLimiter,
  resendOTP
);

router.post(
  '/phone/verify-otp',
  authenticate,
  checkAccountStatus,
  verifyOTPValidation,
  validateRequest,
  strictLimiter,
  verifyOTP
);

router.get('/phone/status', authenticate, checkAccountStatus, getPhoneStatus);

router.post('/submit', authenticate, checkAccountStatus, submitKYC);

router.put('/update', authenticate, checkAccountStatus, updateKYC);

router.post(
  '/document/upload',
  authenticate,
  kycUploadLimiter,
  handleKYCUpload,
  uploadDocument
);

export default router;

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
  faceLivenessValidation,
} from '../validations/kyc.validation';

import { handleKYCUpload } from '../middleware/kyc-upload.middleware';
import { uploadDocument } from '../controllers/upload-document.controller';
import { verifyFaceLiveness } from '../controllers/verify-face-liveness.controller';




const router = Router();

// GET  /api/kyc/status
router.get('/status', authenticate, getKYCStatus);

// POST /api/kyc/phone/send-otp
router.post('/phone/send-otp', authenticate, checkAccountStatus, sendOTP);

// POST /api/kyc/phone/resend-otp
router.post('/phone/resend-otp', authenticate, sendOTPValidation, checkAccountStatus, resendOTP);

// POST /api/kyc/phone/verify-otp
router.post('/phone/verify-otp', authenticate, checkAccountStatus, verifyOTPValidation, validateRequest, verifyOTP);

// GET /api/kyc/phone/status
router.get('/phone/status', authenticate, checkAccountStatus, getPhoneStatus);

// POST /api/kyc/submit
router.post('/submit', authenticate, checkAccountStatus, submitKYC);

// PUT  /api/kyc/update
router.put('/update', authenticate, checkAccountStatus, updateKYC);


// POST /api/kyc/document/upload
router.post('/document/upload', authenticate, handleKYCUpload, uploadDocument);

// POST /api/kyc/face-liveness
router.post('/face-liveness', authenticate, faceLivenessValidation, validateRequest, verifyFaceLiveness);



export default router;

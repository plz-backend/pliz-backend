import { Router } from 'express';

import { authenticate } from '../../auth/middleware/auth/auth';
import { checkAccountStatus } from '../../auth/middleware/auth/account_status.middleware';
import { strictLimiter } from '../../auth/middleware/auth/rateLimiter';
import { validateRequest } from '../../auth/middleware/auth/validateRequest';
import {
  changeTransactionPin,
  getTransactionPinStatus,
  setupTransactionPin,
  verifyTransactionPin,
} from '../controllers/transaction-pin.controller';
import {
  changeTransactionPinValidation,
  setupTransactionPinValidation,
  verifyTransactionPinValidation,
} from '../validations/transaction-pin.validation';

const router = Router();

router.get('/transaction-pin/status', authenticate, checkAccountStatus, getTransactionPinStatus);

router.post(
  '/transaction-pin/setup',
  authenticate,
  checkAccountStatus,
  strictLimiter,
  setupTransactionPinValidation,
  validateRequest,
  setupTransactionPin
);

router.post(
  '/transaction-pin/verify',
  authenticate,
  checkAccountStatus,
  strictLimiter,
  verifyTransactionPinValidation,
  validateRequest,
  verifyTransactionPin
);

router.put(
  '/transaction-pin/change',
  authenticate,
  checkAccountStatus,
  strictLimiter,
  changeTransactionPinValidation,
  validateRequest,
  changeTransactionPin
);

export default router;

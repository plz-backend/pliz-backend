import { Router } from 'express';
import { initializeDonation } from '../controllers/initialize_donation';
import { verifyDonation } from '../controllers/verify_donation';
import { getBegDonations } from '../controllers/get_beg_donations';
import { getMyDonations } from '../controllers/get_my_donations';
import { getDonorRank } from '../controllers/get_donor_rank';
import { sendGratitude } from '../controllers/send_gratitude';
import { sendDonorReply } from '../controllers/send_donor_reply';
import { getDonorMessages, getRecipientMessages } from '../controllers/get_messages';
import { authenticate } from '../../auth/middleware/auth/auth';
import { checkAccountStatus } from '../../auth/middleware/auth/account_status.middleware';
import { generalLimiter } from '../../auth/middleware/auth/rateLimiter';

const router = Router();

// ============================================
// SPECIFIC ROUTES (MUST COME FIRST)
// ============================================

/**
 * @route   POST /api/donations/initialize
 * @desc    Initialize a donation — returns Flutterwave payment URL
 * @access  Private
 */
router.post(
  '/initialize',
  authenticate,
  checkAccountStatus,
  generalLimiter,
  initializeDonation
);

/**
 * @route   POST /api/donations/verify
 * @desc    Verify payment after user returns from Flutterwave
 * @access  Private
 * @body    { transaction_id, tx_ref, status }
 */
router.post(
  '/verify',
  authenticate,
  generalLimiter,
  verifyDonation
);

/**
 * @route   GET /api/donations/my-donations
 * @access  Private
 */
router.get('/my-donations', authenticate, getMyDonations);

/**
 * @route   GET /api/donations/my-rank
 * @access  Private
 */
router.get('/my-rank', authenticate, getDonorRank);

/**
 * @route   GET /api/donations/messages/received
 * @access  Private
 */
router.get('/messages/received', authenticate, getDonorMessages);

/**
 * @route   GET /api/donations/messages/sent
 * @access  Private
 */
router.get('/messages/sent', authenticate, getRecipientMessages);

/**
 * @route   GET /api/donations/beg/:begId
 * @access  Public
 */
router.get('/beg/:begId', generalLimiter, getBegDonations);

// ============================================
// PARAMETERIZED ROUTES (COME LAST)
// ============================================

/**
 * @route   POST /api/donations/:donationId/gratitude
 * @access  Private (Recipient only)
 */
router.post(
  '/:donationId/gratitude',
  authenticate,
  checkAccountStatus,
  sendGratitude
);

/**
 * @route   POST /api/donations/:donationId/reply
 * @access  Private (Donor only)
 */
router.post(
  '/:donationId/reply',
  authenticate,
  checkAccountStatus,
  sendDonorReply
);

export default router;
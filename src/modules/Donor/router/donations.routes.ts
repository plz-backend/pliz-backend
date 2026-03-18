
////
import { Router } from 'express';
import { initializeDonation } from '../controllers/initialize_donation';
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
 * @desc    Initialize a donation (Paystack)
 * @access  Private
 * @middleware checkAccountStatus - Prevents suspended/investigated users from donating
 */
router.post('/initialize', authenticate, checkAccountStatus, generalLimiter, initializeDonation);  // checkAccountStatus

/**
 * @route   GET /api/donations/my-donations
 * @desc    Get user's donation history
 * @access  Private
 * @note    No account status check - allow users to view their donation history even if suspended
 */
router.get('/my-donations', authenticate, getMyDonations);

/**
 * @route   GET /api/donations/my-rank
 * @desc    Get user's donor ranking
 * @access  Private
 * @note    No account status check - informational only
 */
router.get('/my-rank', authenticate, getDonorRank);

/**
 * @route   GET /api/donations/messages/received
 * @desc    Get gratitude messages received (donor view)
 * @access  Private
 * @note    No account status check - allow viewing messages even if suspended
 */
router.get('/messages/received', authenticate, getDonorMessages);

/**
 * @route   GET /api/donations/messages/sent
 * @desc    Get gratitude messages sent (recipient view)
 * @access  Private
 * @note    No account status check - allow viewing sent messages even if suspended
 */
router.get('/messages/sent', authenticate, getRecipientMessages);

/**
 * @route   GET /api/donations/beg/:begId
 * @desc    Get all donations for a specific beg (public)
 * @access  Public
 */
router.get('/beg/:begId', generalLimiter, getBegDonations);

// ============================================
// PARAMETERIZED ROUTES (COME LAST)
// ============================================

/**
 * @route   POST /api/donations/:donationId/gratitude
 * @desc    Send gratitude message to donor
 * @access  Private (Recipient only)
 * @middleware checkAccountStatus - Prevents suspended/investigated recipients from sending messages
 */
router.post('/:donationId/gratitude', authenticate, checkAccountStatus, sendGratitude);  // checkAccountStatus

/**
 * @route   POST /api/donations/:donationId/reply
 * @desc    Donor replies to gratitude message
 * @access  Private (Donor only)
 * @middleware checkAccountStatus - Prevents suspended/investigated donors from replying
 */
router.post('/:donationId/reply', authenticate, checkAccountStatus, sendDonorReply);  // checkAccountStatus

export default router;
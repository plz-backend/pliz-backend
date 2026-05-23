import { Router } from 'express';
import { authenticate } from '../../auth/middleware/auth/auth';
import { requireAdmin } from '../middleware/admin_auth';

// User Management
import { getUsers } from '../controllers/users/get_users';
import { suspendUser } from '../controllers/users/suspend_user';
import { unsuspendUser } from '../controllers/users/unsuspend_user';
import { investigateUser } from '../controllers/users/investigate_user';
import { closeInvestigation } from '../controllers/users/close_investigation';

// Withdrawal Management
import { getAllWithdrawals } from '../controllers/withdrawals/get_all_withdrawals';
import { processWithdrawal } from '../controllers/withdrawals/process_withdrawal';
import { rejectWithdrawal } from '../controllers/withdrawals/reject_withdrawal';

// Analytics
import { getDashboardStats } from '../controllers/analytics/get_dashboard_stats';

// Activity Log
import { getAdminActions } from '../controllers/activity/get_admin_actions';

// Begs (already exist in your code - just import)
import { getAllBegs } from '../controllers/begs/get_all_begs';
import { approveBeg } from '../controllers/begs/approve_beg';
import { rejectBeg } from '../controllers/begs/reject_beg';
import { deleteBeg } from '../controllers/begs/delete_beg';

// Categories (already exist)
import { createCategory } from '../controllers/categories/create_category';
import { updateCategory } from '../controllers/categories/update_category';
import { deleteCategory } from '../controllers/categories/delete_category';
import { getCategories } from '../controllers/categories/get_categories';


// Story Management
import {
  adminGetStories,
  adminGetStoryById,
  adminApproveStory,
  adminRejectStory,
  adminToggleVisibility,
  adminDeleteStory,
} from '../../admin/controllers/Story/admin-story.controller';
import {
  storyIdValidation,
  rejectStoryValidation,
} from '../../Story/validations/story.validation';
import { validateRequest } from '../../auth/middleware/auth/validateRequest';

// Support Ticket Management 
import { getAllTickets } from '../controllers/Support/get-all-tickets.controller';
import { adminReply } from '../controllers/Support/admin-reply.controller';
import { assignTicket } from '../controllers/Support/assign-ticket.controller';
import { updateTicketStatus } from '../controllers/Support/update-ticket-status.controller';
import {
  adminReplyValidation,
  updateStatusValidation,
} from '../../Support/validations/support.validation';

// KYC Management
import { getAllVerifications } from '../controllers/KYC/get-all-verifications.controller';
import { getVerification } from '../controllers/KYC/get-verification.controller';
import { manuallyVerify } from '../controllers/KYC/manually-verify.controller';
import { manuallyReject } from '../controllers/KYC/manually-reject.controller';
import { getVerificationStats } from '../controllers/KYC/get-verification-stats.controller';
import {
  manuallyVerifyValidation,
  manuallyRejectValidation,
} from '../../KYC/validations/kyc.validation';


const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireAdmin);

// ============================================
// USER MANAGEMENT
// ============================================
router.get('/users', getUsers);
router.post('/users/:id/suspend', suspendUser);
router.post('/users/:id/unsuspend', unsuspendUser);
router.post('/users/:id/investigate', investigateUser);
router.post('/users/:id/close-investigation', closeInvestigation);

// ============================================
// WITHDRAWAL MANAGEMENT
// ============================================
router.get('/withdrawals', getAllWithdrawals);
router.post('/withdrawals/:id/process', processWithdrawal);
router.post('/withdrawals/:id/reject', rejectWithdrawal);

// ============================================
// BEG MANAGEMENT
// ============================================

router.get('/begs', getAllBegs);
router.patch('/begs/:id/approve', approveBeg);
router.patch('/begs/:id/reject', rejectBeg);
router.delete('/begs/:id', deleteBeg);

// ============================================
// CATEGORY MANAGEMENT
// ============================================
router.post('/categories', createCategory);
router.patch('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);
router.get('/categories', getCategories);

// ============================================
// ANALYTICS & DASHBOARD
// ============================================
router.get('/dashboard/stats', getDashboardStats);

// ============================================
// ACTIVITY LOG
// ============================================
router.get('/activity', getAdminActions);

// ============================================
// STORY MANAGEMENT
// ============================================

router.get('/stories', adminGetStories);
router.get('/stories/:id', storyIdValidation, validateRequest, adminGetStoryById);
router.patch('/stories/:id/approve', storyIdValidation, validateRequest, adminApproveStory);
router.patch('/stories/:id/reject', rejectStoryValidation, validateRequest, adminRejectStory);
router.patch('/stories/:id/toggle-visibility', storyIdValidation, validateRequest, adminToggleVisibility);
router.delete('/stories/:id', storyIdValidation, validateRequest, adminDeleteStory);

// ============================================
// SUPPORT TICKET MANAGEMENT (optional)
// ============================================
router.get('/tickets', getAllTickets);
router.post('/tickets/:id/reply', adminReplyValidation, validateRequest, adminReply);
router.patch('/tickets/:id/assign', assignTicket);
router.patch('/tickets/:id/status', updateStatusValidation, validateRequest, updateTicketStatus);

// ============================================
// KYC MANAGEMENT
// ============================================
router.get('/kyc/stats', getVerificationStats);
router.get('/kyc', getAllVerifications);
router.get('/kyc/:userId', getVerification);
router.patch('/kyc/:userId/verify', manuallyVerifyValidation, validateRequest, manuallyVerify);
router.patch('/kyc/:userId/reject', manuallyRejectValidation, validateRequest, manuallyReject);


export default router;
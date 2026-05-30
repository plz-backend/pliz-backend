import { Router } from 'express';
import { authenticate } from '../../auth/middleware/auth/auth';
import { requireAdmin } from '../middleware/admin_auth';
import {
  requirePasswordChanged,
  requirePermission,
} from '../middleware/requirePermission';
import { AdminPermission } from '../permissions';

import { getUsers } from '../controllers/users/get_users';
import { suspendUser } from '../controllers/users/suspend_user';
import { unsuspendUser } from '../controllers/users/unsuspend_user';
import { investigateUser } from '../controllers/users/investigate_user';
import { closeInvestigation } from '../controllers/users/close_investigation';

import { getAllWithdrawals } from '../controllers/withdrawals/get_all_withdrawals';
import { processWithdrawal } from '../controllers/withdrawals/process_withdrawal';
import { rejectWithdrawal } from '../controllers/withdrawals/reject_withdrawal';

import { getDashboardStats } from '../controllers/analytics/get_dashboard_stats';
import { getDashboardAnalytics } from '../controllers/analytics/get_dashboard_analytics';

import { getAdminActions } from '../controllers/activity/get_admin_actions';
import { getOperationalEvents } from '../controllers/activity/get-operational-events';

import { getAllBegs } from '../controllers/begs/get_all_begs';
import { approveBeg } from '../controllers/begs/approve_beg';
import { rejectBeg } from '../controllers/begs/reject_beg';
import { deleteBeg } from '../controllers/begs/delete_beg';

import { createCategory } from '../controllers/categories/create_category';
import { updateCategory } from '../controllers/categories/update_category';
import { deleteCategory } from '../controllers/categories/delete_category';
import { getCategories } from '../controllers/categories/get_categories';

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

import { getAllTickets } from '../controllers/Support/get-all-tickets.controller';
import { adminReply } from '../controllers/Support/admin-reply.controller';
import { assignTicket } from '../controllers/Support/assign-ticket.controller';
import { updateTicketStatus } from '../controllers/Support/update-ticket-status.controller';
import {
  adminReplyValidation,
  updateStatusValidation,
} from '../../Support/validations/support.validation';

import { getAllVerifications } from '../controllers/KYC/get-all-verifications.controller';
import { getVerification } from '../controllers/KYC/get-verification.controller';
import { manuallyVerify } from '../controllers/KYC/manually-verify.controller';
import { manuallyReject } from '../controllers/KYC/manually-reject.controller';
import { getVerificationStats } from '../controllers/KYC/get-verification-stats.controller';
import {
  manuallyVerifyValidation,
  manuallyRejectValidation,
} from '../../KYC/validations/kyc.validation';

import { getTeamMembers } from '../controllers/team/get-team.controller';
import { inviteTeamMember } from '../controllers/team/invite-team.controller';
import { updateTeamMember } from '../controllers/team/update-team.controller';

const router = Router();

router.use(authenticate, requireAdmin, requirePasswordChanged);

const p = requirePermission;

router.get('/dashboard/stats', p(AdminPermission.DASHBOARD_VIEW), getDashboardStats);
router.get('/dashboard/analytics', p(AdminPermission.DASHBOARD_VIEW), getDashboardAnalytics);

router.get('/team', p(AdminPermission.TEAM_MANAGE), getTeamMembers);
router.post('/team/invite', p(AdminPermission.TEAM_MANAGE), inviteTeamMember);
router.patch('/team/:id', p(AdminPermission.TEAM_MANAGE), updateTeamMember);

router.get('/users', p(AdminPermission.USERS_VIEW), getUsers);
router.post('/users/:id/suspend', p(AdminPermission.USERS_MODERATE), suspendUser);
router.post('/users/:id/unsuspend', p(AdminPermission.USERS_MODERATE), unsuspendUser);
router.post('/users/:id/investigate', p(AdminPermission.USERS_MODERATE), investigateUser);
router.post('/users/:id/close-investigation', p(AdminPermission.USERS_MODERATE), closeInvestigation);

router.get('/withdrawals', p(AdminPermission.WITHDRAWALS_VIEW), getAllWithdrawals);
router.post('/withdrawals/:id/process', p(AdminPermission.WITHDRAWALS_PROCESS), processWithdrawal);
router.post('/withdrawals/:id/reject', p(AdminPermission.WITHDRAWALS_PROCESS), rejectWithdrawal);

router.get('/begs', p(AdminPermission.BEGS_VIEW), getAllBegs);
router.patch('/begs/:id/approve', p(AdminPermission.BEGS_MODERATE), approveBeg);
router.patch('/begs/:id/reject', p(AdminPermission.BEGS_MODERATE), rejectBeg);
router.delete('/begs/:id', p(AdminPermission.BEGS_MODERATE), deleteBeg);

router.get('/categories', p(AdminPermission.CATEGORIES_MANAGE), getCategories);
router.post('/categories', p(AdminPermission.CATEGORIES_MANAGE), createCategory);
router.patch('/categories/:id', p(AdminPermission.CATEGORIES_MANAGE), updateCategory);
router.delete('/categories/:id', p(AdminPermission.CATEGORIES_MANAGE), deleteCategory);

router.get('/activity', p(AdminPermission.ACTIVITY_VIEW), getAdminActions);
router.get('/operational-events', p(AdminPermission.OPS_VIEW), getOperationalEvents);

router.get('/stories', p(AdminPermission.STORIES_VIEW), adminGetStories);
router.get('/stories/:id', p(AdminPermission.STORIES_VIEW), storyIdValidation, validateRequest, adminGetStoryById);
router.patch('/stories/:id/approve', p(AdminPermission.STORIES_MODERATE), storyIdValidation, validateRequest, adminApproveStory);
router.patch('/stories/:id/reject', p(AdminPermission.STORIES_MODERATE), rejectStoryValidation, validateRequest, adminRejectStory);
router.patch('/stories/:id/toggle-visibility', p(AdminPermission.STORIES_MODERATE), storyIdValidation, validateRequest, adminToggleVisibility);
router.delete('/stories/:id', p(AdminPermission.STORIES_MODERATE), storyIdValidation, validateRequest, adminDeleteStory);

router.get('/tickets', p(AdminPermission.USERS_VIEW), getAllTickets);
router.post('/tickets/:id/reply', p(AdminPermission.USERS_MODERATE), adminReplyValidation, validateRequest, adminReply);
router.patch('/tickets/:id/assign', p(AdminPermission.USERS_MODERATE), assignTicket);
router.patch('/tickets/:id/status', p(AdminPermission.USERS_MODERATE), updateStatusValidation, validateRequest, updateTicketStatus);

router.get('/kyc/stats', p(AdminPermission.KYC_VIEW), getVerificationStats);
router.get('/kyc', p(AdminPermission.KYC_VIEW), getAllVerifications);
router.get('/kyc/:userId', p(AdminPermission.KYC_VIEW), getVerification);
router.patch('/kyc/:userId/verify', p(AdminPermission.KYC_MODERATE), manuallyVerifyValidation, validateRequest, manuallyVerify);
router.patch('/kyc/:userId/reject', p(AdminPermission.KYC_MODERATE), manuallyRejectValidation, validateRequest, manuallyReject);

export default router;

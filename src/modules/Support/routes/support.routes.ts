import { Router } from 'express';
import { authenticate } from '../../auth/middleware/auth/auth';
import { checkAccountStatus } from '../../auth/middleware/auth/account_status.middleware';
import { validateRequest } from '../../auth/middleware/auth/validateRequest';
import { aiChat } from '../controllers/ai-chat.controller';
import { escalateToHuman } from '../controllers/escalate-to-human.controller';
import { createTicket } from '../controllers/create-ticket.controller';
import { getTickets } from '../controllers/get-tickets.controller';
import { getTicket } from '../controllers/get-ticket.controller';
import { replyTicket } from '../controllers/reply-ticket.controller';
import { closeTicket } from '../controllers/close-ticket.controller';
import {
  aiChatValidation,
  escalateValidation,
  createTicketValidation,
  replyTicketValidation,
} from '../validations/support.validation';

const router = Router();

// ============================================
// AI CHAT
// ============================================
router.post('/chat', authenticate, aiChatValidation, validateRequest, aiChat);
router.post('/chat/escalate', authenticate, escalateValidation, validateRequest, escalateToHuman);

// ============================================
// TICKETS
// ============================================
router.post('/tickets', authenticate, checkAccountStatus, createTicketValidation, validateRequest, createTicket);
router.get('/tickets', authenticate, getTickets);
router.get('/tickets/:id', authenticate, getTicket);
router.post('/tickets/:id/reply', authenticate, replyTicketValidation, validateRequest, replyTicket);
router.patch('/tickets/:id/close', authenticate, closeTicket);

export default router;
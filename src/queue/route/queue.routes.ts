import { Router } from 'express';
import { authenticate } from '../../modules/auth/middleware/auth/auth'
import { requireAdmin } from '../../modules/admin/middleware/admin_auth';
import { getQueuesHealth } from '../../queue/controllers/queue.controller';

const router = Router();

router.get('/health', authenticate, requireAdmin, getQueuesHealth);

export default router;
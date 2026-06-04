import { Router } from 'express';
import type { RequestHandler } from 'express';
import { authenticate } from '../../auth/middleware/auth/auth';
import { getCards } from '../controllers/get_cards';
import { setDefaultCard } from '../controllers/set_default_card';
import { deleteCard } from '../controllers/delete_card';
import { strictLimiter } from '../../auth/middleware/auth/rateLimiter';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/cards', getCards);
router.patch('/cards/:id/default', strictLimiter, setDefaultCard as unknown as RequestHandler);
router.delete('/cards/:id', strictLimiter, deleteCard as unknown as RequestHandler);

export default router;

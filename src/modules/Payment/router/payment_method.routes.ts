import { Router } from 'express';
import { authenticate } from '../../auth/middleware/auth/auth';
import { getCards } from '../controllers/get_cards';
import { setDefaultCard } from '../controllers/set_default_card';
import { deleteCard } from '../controllers/delete_card';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.get('/cards', getCards);
router.patch('/cards/:id/default', setDefaultCard);
router.delete('/cards/:id', deleteCard);

export default router;
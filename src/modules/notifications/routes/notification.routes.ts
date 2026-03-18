import { Router } from 'express';
import { getNotifications, getUnreadCount } from '../controllers/get_notifications';
import { markAsRead } from '../controllers/mark_read';
import {  markAllAsRead } from '../controllers/mark_all_as_read';
import { deleteNotification } from '../controllers/delete_notification';
import { authenticate } from '../../auth/middleware/auth/auth';

const router = Router();

// GET /api/notifications
router.get('/', authenticate, getNotifications);

// GET /api/notifications/unread-count
router.get('/unread-count', authenticate, getUnreadCount);

// PATCH /api/notifications/read-all  ← must be BEFORE /:id
router.patch('/read-all', authenticate, markAllAsRead);

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authenticate, markAsRead);

// DELETE /api/notifications/:id
router.delete('/:id', authenticate, deleteNotification);

export default router;
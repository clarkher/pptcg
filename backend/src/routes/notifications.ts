import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { myNotifications, markRead, markAllRead } from '../controllers/notifications';

const router = Router();
router.use(authMiddleware);
router.get('/mine', myNotifications);
router.patch('/:id/read', markRead);
router.post('/read-all', markAllRead);
export default router;

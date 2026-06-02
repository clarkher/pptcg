import { Router } from 'express';
import { register, login, googleLogin, me } from '../controllers/auth';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/me', authMiddleware, me);
export default router;

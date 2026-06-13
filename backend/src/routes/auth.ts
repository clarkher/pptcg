import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  register, login, googleLogin, me,
  verifyEmail, resendVerification,
  forgotPassword, resetPassword,
} from '../controllers/auth';
import { authMiddleware } from '../middleware/auth';

const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '嘗試次數過多，請 15 分鐘後再試' },
});

const router = Router();
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/verify-email', verifyEmail);
router.post('/forgot-password', sensitiveLimiter, forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/resend-verification', authMiddleware, sensitiveLimiter, resendVerification);
router.get('/me', authMiddleware, me);
export default router;

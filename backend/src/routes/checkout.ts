import { Router } from 'express';
import { createCheckout, selectStore, confirmStore, getPending } from '../controllers/checkout';
import { authMiddleware } from '../middleware/auth';
import { requireVerified } from '../middleware/requireVerified';

const router = Router();
router.use(authMiddleware);
router.post('/', requireVerified, createCheckout);
router.post('/select-store', selectStore);
router.post('/confirm-store', confirmStore);
router.get('/pending/:id', getPending);
export default router;

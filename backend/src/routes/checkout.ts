import { Router } from 'express';
import { createCheckout, selectStore, confirmStore, getPending } from '../controllers/checkout';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);
router.post('/', createCheckout);
router.post('/select-store', selectStore);
router.post('/confirm-store', confirmStore);
router.get('/pending/:id', getPending);
export default router;

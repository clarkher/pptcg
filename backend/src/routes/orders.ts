import { Router } from 'express';
import { buyListing, getMyOrders } from '../controllers/orders';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.post('/', authMiddleware, buyListing);
router.get('/mine', authMiddleware, getMyOrders);
export default router;

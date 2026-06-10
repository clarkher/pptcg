import { Router } from 'express';
import { getMyOrders, getOrder, getOrderByTradeNo } from '../controllers/orders';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);
router.get('/mine', getMyOrders);
router.get('/by-trade-no/:tradeNo', getOrderByTradeNo);
router.get('/:id', getOrder);
export default router;

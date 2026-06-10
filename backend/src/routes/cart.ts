import { Router } from 'express';
import { getCart, addToCart, removeFromCart, clearCart } from '../controllers/cart';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);
router.get('/', getCart);
router.post('/', addToCart);
router.delete('/:listingId', removeFromCart);
router.delete('/', clearCart);
export default router;

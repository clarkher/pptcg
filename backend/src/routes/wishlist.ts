import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { addWishlist, removeWishlist, myWishlist } from '../controllers/wishlist';

const router = Router();
router.use(authMiddleware);
router.post('/', addWishlist);
router.delete('/', removeWishlist);
router.get('/mine', myWishlist);
export default router;

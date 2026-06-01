import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import {
  adminGetListings, adminCreateListing, adminUpdateListing, adminDeleteListing,
  adminGetOrders, adminUpdateOrder, adminGetStats,
} from '../controllers/admin';

const router = Router();
const guard = [authMiddleware, adminMiddleware];

router.get('/stats', ...guard, adminGetStats);
router.get('/listings', ...guard, adminGetListings);
router.post('/listings', ...guard, adminCreateListing);
router.patch('/listings/:id', ...guard, adminUpdateListing);
router.delete('/listings/:id', ...guard, adminDeleteListing);
router.get('/orders', ...guard, adminGetOrders);
router.patch('/orders/:id', ...guard, adminUpdateOrder);

export default router;

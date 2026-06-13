import { Router } from 'express';
import { getListings, createListing, getMyListings, deleteListing } from '../controllers/listings';
import { authMiddleware } from '../middleware/auth';
import { requireVerified } from '../middleware/requireVerified';

const router = Router();
router.get('/', getListings);
router.post('/', authMiddleware, requireVerified, createListing);
router.get('/mine', authMiddleware, getMyListings);
router.delete('/:id', authMiddleware, deleteListing);
export default router;

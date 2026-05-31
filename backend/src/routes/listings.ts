import { Router } from 'express';
import { getListings, createListing, getMyListings, deleteListing } from '../controllers/listings';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.get('/', getListings);
router.post('/', authMiddleware, createListing);
router.get('/mine', authMiddleware, getMyListings);
router.delete('/:id', authMiddleware, deleteListing);
export default router;

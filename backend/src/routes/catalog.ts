import { Router } from 'express';
import { listRarities, listConditions } from '../controllers/refdata';
import { listCatalogCards, getCatalogCard } from '../controllers/catalog';
import { optionalAuth } from '../middleware/auth';

const router = Router();
router.get('/rarities', listRarities);
router.get('/conditions', listConditions);
router.get('/cards', listCatalogCards);
router.get('/cards/:id', optionalAuth, getCatalogCard);
export default router;

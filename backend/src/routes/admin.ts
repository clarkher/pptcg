import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import {
  adminGetListings, adminCreateListing, adminUpdateListing, adminDeleteListing,
  adminGetOrders, adminUpdateOrder, adminGetStats,
} from '../controllers/admin';
import {
  listRarities, createRarity, updateRarity, deleteRarity,
  listConditions, createCondition, updateCondition, deleteCondition,
  listSeriesDefs, createSeriesDef, updateSeriesDef, deleteSeriesDef,
} from '../controllers/refdata';

const router = Router();
const guard = [authMiddleware, adminMiddleware];

router.get('/stats', ...guard, adminGetStats);
router.get('/listings', ...guard, adminGetListings);
router.post('/listings', ...guard, adminCreateListing);
router.patch('/listings/:id', ...guard, adminUpdateListing);
router.delete('/listings/:id', ...guard, adminDeleteListing);
router.get('/orders', ...guard, adminGetOrders);
router.patch('/orders/:id', ...guard, adminUpdateOrder);

router.get('/rarities', ...guard, listRarities);
router.post('/rarities', ...guard, createRarity);
router.patch('/rarities/:id', ...guard, updateRarity);
router.delete('/rarities/:id', ...guard, deleteRarity);

router.get('/conditions', ...guard, listConditions);
router.post('/conditions', ...guard, createCondition);
router.patch('/conditions/:id', ...guard, updateCondition);
router.delete('/conditions/:id', ...guard, deleteCondition);

router.get('/series-defs', ...guard, listSeriesDefs);
router.post('/series-defs', ...guard, createSeriesDef);
router.patch('/series-defs/:id', ...guard, updateSeriesDef);
router.delete('/series-defs/:id', ...guard, deleteSeriesDef);

export default router;

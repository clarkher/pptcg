import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { adminMiddleware } from '../middleware/admin';
import {
  adminGetListings, adminCreateListing, adminUpdateListing, adminDeleteListing,
  adminGetOrders, adminUpdateOrder, refundOrder, adminGetStats,
  adminCreateInventory, adminUpdateInventory, adminDeleteInventory,
  adminCatalog, adminCardWishlist, adminWishlistOverview,
  adminUpdateCard, adminCreateCard, adminOrphanListings,
  adminGetSettings, adminUpsertSetting, adminGenLineBindToken, adminLineSetupWebhook,
} from '../controllers/admin';
import {
  listRarities, createRarity, updateRarity, deleteRarity,
  listConditions, createCondition, updateCondition, deleteCondition,
  listSeriesDefs, createSeriesDef, updateSeriesDef, deleteSeriesDef,
} from '../controllers/refdata';
import { adminKapaiScan, adminHucaCards } from '../controllers/kapai-admin';

const router = Router();
const guard = [authMiddleware, adminMiddleware];

router.get('/stats', ...guard, adminGetStats);
router.get('/listings', ...guard, adminGetListings);
router.post('/listings', ...guard, adminCreateListing);
router.patch('/listings/:id', ...guard, adminUpdateListing);
router.delete('/listings/:id', ...guard, adminDeleteListing);
router.get('/orders', ...guard, adminGetOrders);
router.patch('/orders/:id', ...guard, adminUpdateOrder);
router.post('/orders/:id/refund', ...guard, refundOrder);

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

router.get('/catalog', ...guard, adminCatalog);
router.post('/inventory', ...guard, adminCreateInventory);
router.patch('/inventory/:id', ...guard, adminUpdateInventory);
router.delete('/inventory/:id', ...guard, adminDeleteInventory);
router.get('/wishlist', ...guard, adminCardWishlist);
router.get('/wishlist-overview', ...guard, adminWishlistOverview);
router.post('/cards', ...guard, adminCreateCard);
router.patch('/cards/:id', ...guard, adminUpdateCard);
router.get('/orphan-listings', ...guard, adminOrphanListings);

// Settings & LINE
router.get('/settings', ...guard, adminGetSettings);
router.put('/settings/:key', ...guard, adminUpsertSetting);
router.post('/line/bind-token', authMiddleware, adminGenLineBindToken); // kept for backwards compat
router.post('/line/setup-webhook', ...guard, adminLineSetupWebhook);   // auto-configure LINE webhook

// 卡報報監控檢視
router.get('/kapai/scan', ...guard, adminKapaiScan); // 立即掃描當前套利（不推不存）
router.get('/huca', ...guard, adminHucaCards);        // Huca 行情純檢視

export default router;

import { Router } from 'express';
import { listRarities, listConditions } from '../controllers/refdata';

const router = Router();
router.get('/rarities', listRarities);
router.get('/conditions', listConditions);
export default router;

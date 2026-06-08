import { Router } from 'express';
import { lineWebhook } from '../controllers/line';

const router = Router();

// POST /api/line/webhook
// Note: body is parsed as raw Buffer (registered in app.ts BEFORE express.json())
router.post('/webhook', lineWebhook);

export default router;

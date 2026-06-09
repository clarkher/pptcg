import { Router } from 'express';
import express from 'express';
import { authMiddleware } from '../middleware/auth';
import { lineWebhook, lineInfo, lineBindStatus, lineGenBindToken, lineUnbind } from '../controllers/line';

const router = Router();

// ── Webhook (raw buffer for HMAC signature verification) ──────
router.post('/webhook', express.raw({ type: '*/*' }), lineWebhook);

// ── Public ────────────────────────────────────────────────────
router.get('/info', lineInfo);

// ── Authed user-facing ────────────────────────────────────────
router.get('/status', authMiddleware, lineBindStatus);
router.post('/bind-token', authMiddleware, lineGenBindToken);
router.delete('/unbind', authMiddleware, lineUnbind);

export default router;

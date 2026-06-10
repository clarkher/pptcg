import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { lineInfo, lineBindStatus, lineGenBindToken, lineUnbind } from '../controllers/line';

const router = Router();

// Note: POST /webhook is registered directly in app.ts BEFORE express.json()
// because it needs the raw Buffer body for HMAC signature verification.

// ── Public ────────────────────────────────────────────────────
router.get('/info', lineInfo);

// ── Authed user-facing ────────────────────────────────────────
router.get('/status', authMiddleware, lineBindStatus);
router.post('/bind-token', authMiddleware, lineGenBindToken);
router.delete('/unbind', authMiddleware, lineUnbind);

export default router;

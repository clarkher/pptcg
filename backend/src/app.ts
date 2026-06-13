import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import cardRoutes from './routes/cards';
import listingRoutes from './routes/listings';
import orderRoutes from './routes/orders';
import adminRoutes from './routes/admin';
import pokemonRoutes from './routes/pokemon';
import uploadRoutes from './routes/upload';
import catalogRoutes from './routes/catalog';
import wishlistRoutes from './routes/wishlist';
import notificationRoutes from './routes/notifications';
import lineRoutes from './routes/line';
import { lineWebhook } from './controllers/line';
import cartRoutes from './routes/cart';
import checkoutRoutes from './routes/checkout';
import ecpayRoutes from './routes/ecpay';

const app = express();
app.set('trust proxy', 1);

const STATIC_ORIGINS = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'https://pipicards.com',
  'https://www.pipicards.com',
];
app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin / curl (no origin), static allowlist, and any Vercel deployment
    if (!origin || STATIC_ORIGINS.includes(origin) || /\.vercel\.app$/.test(new URL(origin).hostname)) {
      cb(null, true);
    } else {
      cb(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
}));
// LINE webhook needs the raw Buffer for HMAC signature verification —
// must be registered BEFORE express.json() consumes the request stream.
app.post('/api/line/webhook', express.raw({ type: '*/*' }), lineWebhook);

app.use(express.json());
// ECPay callbacks post application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));

// Other LINE routes (status/bind-token/unbind/info — no raw body needed)
app.use('/api/line', lineRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/ecpay', ecpayRoutes);

app.use('/api/admin', adminRoutes);
app.use('/api/pokemon', pokemonRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/notifications', notificationRoutes);
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'PPTCG API' }));

export default app;

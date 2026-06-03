import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import cardRoutes from './routes/cards';
import listingRoutes from './routes/listings';
import orderRoutes from './routes/orders';
import adminRoutes from './routes/admin';
import pokemonRoutes from './routes/pokemon';
import uploadRoutes from './routes/upload';

const app = express();

const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'https://pipicards.com',
  'https://www.pipicards.com',
];
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/orders', orderRoutes);

app.use('/api/admin', adminRoutes);
app.use('/api/pokemon', pokemonRoutes);
app.use('/api/upload', uploadRoutes);
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'PPTCG API' }));

export default app;

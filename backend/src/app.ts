import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import cardRoutes from './routes/cards';
import listingRoutes from './routes/listings';
import orderRoutes from './routes/orders';
import adminRoutes from './routes/admin';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/orders', orderRoutes);

app.use('/api/admin', adminRoutes);
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'PPTCG API' }));

export default app;

import 'dotenv/config';
import app from './app';
import { releaseExpiredReservations } from './lib/reservation';

const PORT = parseInt(process.env.PORT || '3001');

app.listen(PORT, () => {
  console.log(`🃏 PPTCG API running on http://localhost:${PORT}`);
});

// 逾時預留回收：每 3 分鐘釋放未付款且已逾時的訂單庫存，並清理過期 PendingCheckout
const RELEASE_INTERVAL_MS = 3 * 60 * 1000;
setInterval(() => {
  releaseExpiredReservations()
    .then((n) => { if (n > 0) console.log(`♻️  released ${n} expired reservation(s)`); })
    .catch((err) => console.error('releaseExpiredReservations failed:', err));
}, RELEASE_INTERVAL_MS).unref();

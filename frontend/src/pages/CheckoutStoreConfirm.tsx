import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Store } from 'lucide-react';
import { checkoutApi, type PendingCheckoutInfo } from '../api/checkout';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function CheckoutStoreConfirm() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const pendingId = params.get('id') ?? '';
  const [pending, setPending] = useState<PendingCheckoutInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pendingId) { setError('缺少門市選取記錄'); return; }
    checkoutApi.getPending(pendingId)
      .then(setPending)
      .catch(() => setError('找不到選取記錄，請重新結帳'));
  }, [pendingId]);

  const handleConfirm = async () => {
    setSubmitting(true);
    setError('');
    try {
      const { merchantTradeNo } = await checkoutApi.confirmStore(pendingId);
      navigate(`/order-result?tradeNo=${encodeURIComponent(merchantTradeNo)}&status=success`, { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || '建立訂單失敗，請稍後再試');
      setSubmitting(false);
    }
  };

  return (
    <div style={{ paddingBottom: 128, paddingTop: 32 }} className="page-enter">
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>
        <h2 style={{ color: '#F1F5F9', fontWeight: 800, fontSize: 20, marginBottom: 20 }}>確認取貨門市</h2>

        {!pending && !error && <LoadingSpinner />}

        {pending?.storeId && (
          <div style={{ background: 'rgba(139,92,246,0.08)', borderRadius: 16, padding: '20px', marginBottom: 24, border: '1px solid rgba(139,92,246,0.2)' }}>
            <Store size={24} color="#8B5CF6" style={{ marginBottom: 12 }} />
            <p style={{ color: '#F1F5F9', fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{pending.storeName}</p>
            {pending.storeAddress && <p style={{ color: '#64748B', fontSize: 13 }}>{pending.storeAddress}</p>}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 12, paddingTop: 12 }}>
              <p style={{ color: '#94A3B8', fontSize: 13 }}>收件人：{pending.receiverName}（{pending.receiverPhone}）</p>
            </div>
          </div>
        )}

        {pending && !pending.storeId && (
          <p style={{ color: '#F59E0B', marginBottom: 16, fontSize: 14 }}>尚未選擇門市，請返回結帳頁重新選擇</p>
        )}

        {error && <p style={{ color: '#EF4444', marginBottom: 16, fontWeight: 600, fontSize: 14 }}>{error}</p>}

        <button
          onClick={handleConfirm}
          disabled={submitting || !pending?.storeId}
          style={{
            width: '100%', padding: '16px', borderRadius: 16,
            background: submitting || !pending?.storeId ? 'rgba(139,92,246,0.35)' : 'linear-gradient(135deg,#8B5CF6,#7C3AED)',
            color: '#fff', fontWeight: 800, fontSize: 16, border: 'none',
            cursor: submitting || !pending?.storeId ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? '建立訂單中…' : '確認，建立訂單'}
        </button>

        <button onClick={() => navigate('/checkout')} style={{ display: 'block', margin: '16px auto 0', color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
          ← 返回重新選擇
        </button>
      </div>
    </div>
  );
}

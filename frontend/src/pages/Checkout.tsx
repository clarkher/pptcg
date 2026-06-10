import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import { checkoutApi, submitEcpayForm, type PaymentMethod, type ShippingType } from '../api/checkout';

const SHIPPING_LABELS: Record<ShippingType, string> = {
  UNIMART: '7-ELEVEN',
  FAMI: '全家',
  HILIFE: '萊爾富',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 10,
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
  color: '#F1F5F9', fontSize: 14, boxSizing: 'border-box', outline: 'none',
};

export function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { items, fetch } = useCartStore();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit');
  const [shippingType, setShippingType] = useState<ShippingType>('UNIMART');
  const [receiverName, setReceiverName] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetch();
  }, [user]);

  const total = items.reduce((sum, i) => sum + i.listing.price * i.quantity, 0);

  const handleSubmit = async () => {
    if (!receiverName.trim() || !receiverPhone.trim()) {
      setError('請填寫收件人姓名和電話');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      if (paymentMethod === 'cvs_cod') {
        const res = await checkoutApi.selectStore(receiverName.trim(), receiverPhone.trim(), shippingType);
        submitEcpayForm(res.ecpayUrl, res.ecpayParams);  // 跳轉綠界門市地圖
      } else {
        const res = await checkoutApi.create(paymentMethod, receiverName.trim(), receiverPhone.trim());
        submitEcpayForm(res.ecpayUrl, res.ecpayParams);  // 跳轉綠界付款頁
      }
      // 頁面即將跳轉，不重置 submitting
    } catch (err: any) {
      setError(err.response?.data?.error || '結帳失敗，請稍後再試');
      setSubmitting(false);
    }
  };

  return (
    <div style={{ paddingBottom: 128, paddingTop: 20 }} className="page-enter">
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>
        <button onClick={() => navigate('/cart')} style={{ color: '#8B5CF6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, marginBottom: 20, fontSize: 14 }}>
          ← 返回購物車
        </button>

        <h2 style={{ color: '#F1F5F9', fontWeight: 800, fontSize: 20, marginBottom: 20 }}>結帳</h2>

        {/* 訂單摘要 */}
        <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '14px 16px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.07)' }}>
          <p style={{ color: '#64748B', fontSize: 12, fontWeight: 700, marginBottom: 10, letterSpacing: 1 }}>訂單摘要</p>
          {items.map(i => (
            <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
              <span style={{ color: '#94A3B8', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {i.listing.cardName} ×{i.quantity}
              </span>
              <span style={{ color: '#F1F5F9', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                NT${(i.listing.price * i.quantity).toLocaleString()}
              </span>
            </div>
          ))}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#94A3B8', fontWeight: 700, fontSize: 14 }}>合計</span>
            <span style={{ color: '#A78BFA', fontWeight: 900, fontSize: 18 }}>NT${total.toLocaleString()}</span>
          </div>
        </div>

        {/* 收件人 */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: '#94A3B8', fontSize: 12, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>收件人資訊</p>
          <input
            value={receiverName}
            onChange={e => setReceiverName(e.target.value)}
            placeholder="姓名（取貨需與證件相符）"
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          <input
            value={receiverPhone}
            onChange={e => setReceiverPhone(e.target.value)}
            placeholder="手機號碼（09xxxxxxxx）"
            inputMode="tel"
            style={inputStyle}
          />
        </div>

        {/* 付款方式 */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ color: '#94A3B8', fontSize: 12, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>付款方式</p>
          {([
            ['credit', '💳 信用卡（一次付清）'],
            ['cvs', '🏪 超商代碼（3 天內至超商付款）'],
            ['cvs_cod', '📦 超商取貨付款（到店取貨付現）'],
          ] as [PaymentMethod, string][]).map(([m, label]) => (
            <label key={m} style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer',
              background: paymentMethod === m ? 'rgba(139,92,246,0.10)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${paymentMethod === m ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 12, padding: '12px 14px',
            }}>
              <input type="radio" value={m} checked={paymentMethod === m} onChange={() => setPaymentMethod(m)} style={{ accentColor: '#8B5CF6' }} />
              <span style={{ color: '#F1F5F9', fontWeight: 600, fontSize: 14 }}>{label}</span>
            </label>
          ))}
        </div>

        {/* 超商取貨：選擇超商品牌 */}
        {paymentMethod === 'cvs_cod' && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ color: '#94A3B8', fontSize: 12, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>選擇超商</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['UNIMART', 'FAMI', 'HILIFE'] as ShippingType[]).map(s => (
                <button
                  key={s}
                  onClick={() => setShippingType(s)}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    background: shippingType === s ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.04)',
                    color: shippingType === s ? '#A78BFA' : '#94A3B8',
                    border: `1px solid ${shippingType === s ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {SHIPPING_LABELS[s]}
                </button>
              ))}
            </div>
            <p style={{ color: '#64748B', fontSize: 12, marginTop: 8 }}>
              點「選擇取貨門市」後將開啟綠界門市地圖
            </p>
          </div>
        )}

        {error && (
          <p style={{ color: '#EF4444', fontWeight: 600, marginBottom: 12, fontSize: 14 }}>{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || items.length === 0}
          style={{
            width: '100%', padding: '16px', borderRadius: 16,
            background: submitting || items.length === 0 ? 'rgba(139,92,246,0.35)' : 'linear-gradient(135deg,#8B5CF6,#7C3AED)',
            color: '#fff', fontWeight: 800, fontSize: 16, border: 'none',
            cursor: submitting || items.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? '處理中…' : paymentMethod === 'cvs_cod' ? '選擇取貨門市 →' : '前往付款 →'}
        </button>
      </div>
    </div>
  );
}

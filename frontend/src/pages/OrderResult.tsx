import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { ordersApi } from '../api/orders';
import type { Order } from '../types';

export function OrderResult() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tradeNo = params.get('tradeNo') ?? '';
  const status = params.get('status');
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (!tradeNo) return;
    let tries = 0;
    let cancelled = false;
    const poll = async () => {
      try {
        const data = await ordersApi.getByTradeNo(tradeNo);
        if (!cancelled) setOrder(data);
      } catch {
        if (!cancelled && tries++ < 5) setTimeout(poll, 2000);
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [tradeNo]);

  const isSuccess = status === 'success';

  return (
    <div style={{ paddingBottom: 128, paddingTop: 48 }} className="page-enter">
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px', textAlign: 'center' }}>
        {isSuccess ? (
          <>
            <CheckCircle2 size={56} color="#34D399" style={{ marginBottom: 16 }} />
            <h2 style={{ color: '#34D399', fontWeight: 900, fontSize: 22, marginBottom: 8 }}>
              {order?.paymentMethod === 'cvs' && order?.cvsPaymentCode ? '取號成功！' : '付款成功！'}
            </h2>

            {order?.cvsPaymentCode && (
              <div style={{
                background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
                borderRadius: 16, padding: '20px', margin: '20px 0',
              }}>
                <p style={{ color: '#64748B', fontSize: 12, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>超商繳費代碼</p>
                <p style={{ color: '#34D399', fontWeight: 900, fontSize: 26, letterSpacing: 3, wordBreak: 'break-all' }}>
                  {order.cvsPaymentCode}
                </p>
                {order.cvsExpireDate && (
                  <p style={{ color: '#64748B', fontSize: 12, marginTop: 8 }}>
                    請於 {order.cvsExpireDate} 前至超商繳款
                  </p>
                )}
              </div>
            )}

            {order?.paymentMethod === 'cvs_cod' && (
              <p style={{ color: '#94A3B8', fontSize: 14, marginBottom: 20 }}>
                訂單成立！商品出貨後會通知你到 {order.storeName ?? '門市'} 取貨付款
              </p>
            )}
          </>
        ) : (
          <>
            <XCircle size={56} color="#EF4444" style={{ marginBottom: 16 }} />
            <h2 style={{ color: '#EF4444', fontWeight: 900, fontSize: 22, marginBottom: 8 }}>付款失敗</h2>
            <p style={{ color: '#64748B', marginBottom: 20, fontSize: 14 }}>付款未完成，請返回購物車重試</p>
          </>
        )}

        {order && (
          <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '14px 16px', marginBottom: 20, border: '1px solid rgba(255,255,255,0.07)', textAlign: 'left' }}>
            <p style={{ color: '#64748B', fontSize: 12, marginBottom: 10 }}>訂單編號：{order.merchantTradeNo}</p>
            {order.items.map(i => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, gap: 8 }}>
                <span style={{ color: '#94A3B8', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {i.listing.cardName} ×{i.quantity}
                </span>
                <span style={{ color: '#F1F5F9', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
                  NT${(i.price * i.quantity).toLocaleString()}
                </span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 10, paddingTop: 10, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#94A3B8', fontWeight: 700, fontSize: 14 }}>合計</span>
              <span style={{ color: '#A78BFA', fontWeight: 900 }}>NT${order.total.toLocaleString()}</span>
            </div>
          </div>
        )}

        <button
          onClick={() => navigate(isSuccess ? '/orders' : '/cart')}
          style={{ color: '#8B5CF6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 15 }}
        >
          {isSuccess ? '查看我的訂單 →' : '返回購物車 →'}
        </button>
      </div>
    </div>
  );
}

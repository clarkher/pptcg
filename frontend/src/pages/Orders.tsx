import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { ordersApi } from '../api/orders';
import type { Order } from '../types';
import { Header } from '../components/Header';
import { LoadingSpinner } from '../components/LoadingSpinner';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending_payment: { label: '待付款', color: '#F59E0B' },
  paid: { label: '已付款', color: '#34D399' },
  shipped: { label: '已出貨', color: '#60A5FA' },
  completed: { label: '已完成', color: '#34D399' },
  cancelled: { label: '已取消', color: '#64748B' },
  refunded: { label: '已退款', color: '#EF4444' },
};

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ordersApi.getMine().then(setOrders).finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ paddingBottom: 128 }} className="page-enter">
      <Header title="我的訂單" />

      <div style={{ padding: '8px 16px 0' }}>
        {loading ? (
          <LoadingSpinner />
        ) : orders.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '80px 0', textAlign: 'center',
          }}>
            <div style={{ marginBottom: 16, opacity: 0.15, display: 'flex', justifyContent: 'center' }}>
              <Package size={56} color="#94A3B8" />
            </div>
            <p style={{ color: '#94A3B8', fontWeight: 700, fontSize: 16, marginBottom: 6 }}>還沒有訂單</p>
            <p style={{ color: '#475569', fontSize: 13 }}>去市場逛逛，買張卡吧</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {orders.map((order) => {
              const s = STATUS_LABEL[order.status] ?? STATUS_LABEL['pending_payment'];
              return (
                <div key={order.id} style={{
                  borderRadius: 16, padding: '16px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  backdropFilter: 'blur(12px)',
                }}>
                  {/* 訂單編號 + 日期 + 狀態 */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 11, color: '#64748B', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {order.merchantTradeNo}
                      </p>
                      <p style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                        {new Date(order.createdAt).toLocaleDateString('zh-TW')}
                      </p>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, flexShrink: 0,
                      color: s.color, background: `${s.color}1A`, border: `1px solid ${s.color}40`,
                    }}>{s.label}</span>
                  </div>

                  {/* 品項列表 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {order.items.map((item) => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 44, height: 44, borderRadius: 10, overflow: 'hidden',
                          flexShrink: 0, background: '#09091a',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                          {item.listing.cardImage && (
                            <img src={item.listing.cardImage} alt={item.listing.cardName}
                              style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }} />
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.listing.cardName}
                          </p>
                          <p style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                            {item.listing.condition} · ×{item.quantity}
                          </p>
                        </div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', flexShrink: 0 }}>
                          NT${(item.price * item.quantity).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* 超商繳費代碼（待付款） */}
                  {order.cvsPaymentCode && order.status === 'pending_payment' && (
                    <div style={{
                      background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)',
                      borderRadius: 12, padding: '10px 12px', marginTop: 12,
                    }}>
                      <p style={{ color: '#64748B', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>超商繳費代碼</p>
                      <p style={{ color: '#34D399', fontWeight: 900, fontSize: 16, letterSpacing: 2, wordBreak: 'break-all' }}>
                        {order.cvsPaymentCode}
                      </p>
                      {order.cvsExpireDate && (
                        <p style={{ color: '#64748B', fontSize: 11, marginTop: 4 }}>
                          請於 {order.cvsExpireDate} 前繳款
                        </p>
                      )}
                    </div>
                  )}

                  {/* 取貨門市（超商取貨付款） */}
                  {order.paymentMethod === 'cvs_cod' && order.storeName && (
                    <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 10 }}>
                      取貨門市：<span style={{ color: '#A78BFA', fontWeight: 700 }}>{order.storeName}</span>
                    </p>
                  )}

                  {/* 合計 */}
                  <div style={{
                    borderTop: '1px solid rgba(255,255,255,0.07)', marginTop: 12, paddingTop: 10,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <span style={{ fontSize: 13, color: '#94A3B8', fontWeight: 700 }}>合計</span>
                    <span style={{
                      fontSize: 16, fontWeight: 900,
                      background: 'linear-gradient(135deg, #A78BFA, #7C3AED)',
                      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    }}>
                      NT${order.total.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

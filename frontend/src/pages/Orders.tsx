import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { ordersApi } from '../api/orders';
import type { Order } from '../types';
import { Header } from '../components/Header';
import { GameBadge } from '../components/GameBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';

const STATUS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending:   { label: '待出貨', color: '#FBBF24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)' },
  shipped:   { label: '已出貨', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)',  border: 'rgba(96,165,250,0.25)' },
  completed: { label: '已完成', color: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)' },
  cancelled: { label: '已取消', color: '#94A3B8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)' },
};

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ordersApi.getMine().then(setOrders).finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ paddingBottom: 112 }} className="page-enter">
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
              const s = STATUS[order.status] ?? STATUS['pending'];
              return (
                <div key={order.id} style={{
                  borderRadius: 20, padding: '16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  backdropFilter: 'blur(12px)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    {order.listing.cardImage && (
                      <div style={{
                        width: 60, height: 60, borderRadius: 12, overflow: 'hidden',
                        flexShrink: 0, background: '#09091a',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        <img src={order.listing.cardImage} alt={order.listing.cardName}
                          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                        <GameBadge game={order.listing.cardGame} />
                        <span style={{
                          fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
                          color: s.color, background: s.bg, border: `1px solid ${s.border}`,
                        }}>{s.label}</span>
                      </div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#F1F5F9', lineHeight: 1.3 }}>
                        {order.listing.cardName}
                      </p>
                      <p style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                        賣家：<span style={{ color: '#8B5CF6' }}>{order.seller.username}</span>
                        {' · '}x{order.quantity}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{
                        fontSize: 16, fontWeight: 900,
                        background: 'linear-gradient(135deg, #A78BFA, #7C3AED)',
                        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                      }}>
                        NT${order.total.toLocaleString()}
                      </p>
                      <p style={{ fontSize: 10, color: '#475569', marginTop: 4, fontWeight: 600 }}>
                        {new Date(order.createdAt).toLocaleDateString('zh-TW')}
                      </p>
                    </div>
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

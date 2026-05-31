import { useEffect, useState } from 'react';
import { ordersApi } from '../api/orders';
import type { Order } from '../types';
import { Header } from '../components/Header';
import { GameBadge } from '../components/GameBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: '待出貨', color: '#FBBF24', bg: 'rgba(251,191,36,0.1)' },
  shipped:   { label: '已出貨', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
  completed: { label: '已完成', color: '#4ADE80', bg: 'rgba(74,222,128,0.1)' },
  cancelled: { label: '已取消', color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
};

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ordersApi.getMine().then(setOrders).finally(() => setLoading(false));
  }, []);

  return (
    <div className="pb-28 page-enter">
      <Header title="我的訂單" />

      <div className="px-4 pt-2">
        {loading ? (
          <LoadingSpinner />
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-6xl mb-4 opacity-25">📦</div>
            <p className="text-slate-400 font-semibold text-base">還沒有訂單</p>
            <p className="text-slate-600 text-sm mt-1">去市場逛逛，買張卡吧</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const s = STATUS[order.status] ?? STATUS['pending'];
              return (
                <div key={order.id} className="rounded-2xl p-4"
                  style={{ background: '#111124', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-start gap-3">
                    {order.listing.cardImage && (
                      <div className="rounded-xl overflow-hidden shrink-0"
                        style={{ width: 56, height: 56, background: '#0A0A1E' }}>
                        <img src={order.listing.cardImage} alt={order.listing.cardName}
                          className="w-full h-full object-contain p-1" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <GameBadge game={order.listing.cardGame} />
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ color: s.color, background: s.bg }}>{s.label}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-100 leading-tight">
                        {order.listing.cardName}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        賣家：{order.seller.username} · x{order.quantity}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-base" style={{ color: '#A78BFA' }}>
                        NT${order.total.toLocaleString()}
                      </p>
                      <p className="text-[11px] text-slate-600 mt-1">
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

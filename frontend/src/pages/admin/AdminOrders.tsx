import { useEffect, useState } from 'react';
import { adminApi, type AdminOrder } from '../../api/admin';

const STATUS_OPTIONS = [
  { value: 'pending',   label: '待出貨', color: '#FBBF24', bg: 'rgba(251,191,36,0.1)' },
  { value: 'shipped',   label: '已出貨', color: '#60A5FA', bg: 'rgba(96,165,250,0.1)' },
  { value: 'completed', label: '已完成', color: '#4ADE80', bg: 'rgba(74,222,128,0.1)' },
  { value: 'cancelled', label: '已取消', color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' },
];

export function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { adminApi.getOrders().then(setOrders).finally(() => setLoading(false)); }, []);

  const handleStatusChange = async (orderId: string, status: string) => {
    const updated = await adminApi.updateOrder(orderId, status);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: updated.status } : o)));
  };

  const filtered = statusFilter === 'all' ? orders : orders.filter((o) => o.status === statusFilter);

  return (
    <div className="space-y-6 page-enter">
      <div>
        <h2 className="text-2xl font-black text-white">訂單管理</h2>
        <p className="text-slate-500 text-sm mt-1">{orders.length} 筆訂單</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setStatusFilter('all')}
          className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
          style={statusFilter === 'all'
            ? { background: 'rgba(167,139,250,0.15)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.3)' }
            : { background: '#111124', color: '#64748B', border: '1px solid rgba(255,255,255,0.06)' }}>
          全部 ({orders.length})
        </button>
        {STATUS_OPTIONS.map((s) => {
          const count = orders.filter((o) => o.status === s.value).length;
          return (
            <button key={s.value} onClick={() => setStatusFilter(s.value)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={statusFilter === s.value
                ? { background: s.bg, color: s.color, border: `1px solid ${s.color}40` }
                : { background: '#111124', color: '#64748B', border: '1px solid rgba(255,255,255,0.06)' }}>
              {s.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Orders list */}
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-600">沒有訂單</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            return (
              <div key={order.id} className="rounded-2xl p-4"
                style={{ background: '#111124', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-start gap-4">
                  {/* Card image */}
                  {order.listing?.cardImage && (
                    <div className="rounded-xl overflow-hidden shrink-0"
                      style={{ width: 52, height: 72, background: '#0A0A1E' }}>
                      <img src={order.listing.cardImage} className="w-full h-full object-contain p-1" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-100">{order.listing?.cardName}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          買家：<span className="text-slate-300">{order.buyer.username}</span>
                          <span className="text-slate-600"> · {order.buyer.email}</span>
                        </p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {new Date(order.createdAt).toLocaleString('zh-TW')} · ×{order.quantity}
                        </p>
                      </div>
                      <p className="font-black text-lg shrink-0" style={{ color: '#A78BFA' }}>
                        NT${order.total.toLocaleString()}
                      </p>
                    </div>

                    {/* Status changer */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {STATUS_OPTIONS.map((opt) => (
                        <button key={opt.value}
                          onClick={() => order.status !== opt.value && handleStatusChange(order.id, opt.value)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold transition-all"
                          style={order.status === opt.value
                            ? { background: opt.bg, color: opt.color, border: `1px solid ${opt.color}40` }
                            : { color: '#475569', background: 'rgba(255,255,255,0.03)', cursor: 'pointer' }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

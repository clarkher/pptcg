import { useEffect, useState } from 'react';
import { ordersApi } from '../api/orders';
import type { Order } from '../types';
import { Header } from '../components/Header';
import { GameBadge } from '../components/GameBadge';
import { LoadingSpinner } from '../components/LoadingSpinner';

const STATUS_LABEL: Record<string, string> = {
  pending: '待出貨',
  shipped: '已出貨',
  completed: '已完成',
  cancelled: '已取消',
};

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-yellow-400',
  shipped: 'text-blue-400',
  completed: 'text-green-400',
  cancelled: 'text-red-400',
};

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ordersApi.getMine().then(setOrders).finally(() => setLoading(false));
  }, []);

  return (
    <div className="pb-24">
      <Header title="我的訂單" />

      <div className="px-4 pt-4">
        {loading ? (
          <LoadingSpinner />
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <div className="text-4xl mb-3">📭</div>
            <p>還沒有訂單記錄</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-[#16213E] border border-[#0F3460] rounded-2xl p-4"
              >
                <div className="flex items-start gap-3">
                  {order.listing.cardImage && (
                    <img
                      src={order.listing.cardImage}
                      alt={order.listing.cardName}
                      className="w-14 h-14 object-contain rounded-lg bg-[#0F1629]"
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <GameBadge game={order.listing.cardGame} />
                      <span
                        className={`text-xs font-medium ${STATUS_COLOR[order.status] || 'text-slate-400'}`}
                      >
                        {STATUS_LABEL[order.status] || order.status}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-100">{order.listing.cardName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      賣家：{order.seller.username} · x{order.quantity}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-violet-400 font-bold">NT${order.total}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(order.createdAt).toLocaleDateString('zh-TW')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

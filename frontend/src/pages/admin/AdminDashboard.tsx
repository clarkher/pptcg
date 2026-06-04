import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layers, ClipboardList, Users, Wallet, Plus, Package } from 'lucide-react';
import { adminApi, type AdminStats } from '../../api/admin';

function StatCard({ icon, label, value, sub, accent }: {
  icon: ReactNode; label: string; value: string | number; sub?: string; accent?: string;
}) {
  return (
    <div className="rounded-2xl p-5" style={{ background: '#111124', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-slate-400">{label}</p>
        <span style={{ opacity: 0.5, color: accent || '#94A3B8', display: 'flex' }}>{icon}</span>
      </div>
      <p className="text-3xl font-black" style={{ color: accent || '#F1F5F9' }}>{value}</p>
      {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
    </div>
  );
}

export function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => { adminApi.getStats().then(setStats).catch(console.error); }, []);

  return (
    <div className="space-y-8 page-enter">
      <div>
        <h2 className="text-2xl font-black text-white">後台總覽</h2>
        <p className="text-slate-500 text-sm mt-1">屁TCG 管理後台</p>
      </div>

      {stats ? (
        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={<Layers size={24} />} label="上架中商品" value={stats.activeListings}
            sub={`共 ${stats.totalListings} 件`} accent="#A78BFA" />
          <StatCard icon={<ClipboardList size={24} />} label="待出貨訂單" value={stats.pendingOrders}
            sub={`共 ${stats.totalOrders} 筆`} accent="#FBBF24" />
          <StatCard icon={<Users size={24} />} label="用戶數" value={stats.totalUsers} accent="#60A5FA" />
          <StatCard icon={<Wallet size={24} />} label="累計營收" value={`NT$${stats.revenue.toLocaleString()}`}
            sub="已出貨 + 已完成" accent="#4ADE80" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton rounded-2xl h-28" />
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => navigate('/admin/listings')}
          className="rounded-2xl p-5 text-left transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg,#1E1040,#2D1B69)', border: '1px solid rgba(167,139,250,0.2)' }}>
          <div className="mb-3 text-violet-400"><Plus size={32} /></div>
          <p className="font-bold text-white">新增商品</p>
          <p className="text-xs text-slate-400 mt-1">上架新的卡牌</p>
        </button>
        <button onClick={() => navigate('/admin/orders')}
          className="rounded-2xl p-5 text-left transition-all active:scale-95"
          style={{ background: 'linear-gradient(135deg,#0F2027,#1A3A2A)', border: '1px solid rgba(74,222,128,0.15)' }}>
          <div className="mb-3 text-emerald-400"><Package size={32} /></div>
          <p className="font-bold text-white">處理訂單</p>
          <p className="text-xs text-slate-400 mt-1">更新出貨狀態</p>
        </button>
      </div>
    </div>
  );
}

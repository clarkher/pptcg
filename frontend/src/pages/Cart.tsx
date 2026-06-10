import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, ShoppingCart } from 'lucide-react';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function Cart() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { items, loading, fetch, remove } = useCartStore();

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    fetch();
  }, [user]);

  const total = items.reduce((sum, i) => sum + i.listing.price * i.quantity, 0);
  const hasInactive = items.some(i => i.listing.status !== 'active');

  if (loading && items.length === 0) return <div style={{ paddingTop: 80 }}><LoadingSpinner /></div>;

  return (
    <div style={{ paddingBottom: 128, paddingTop: 20 }} className="page-enter">
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px' }}>
        <h2 style={{ color: '#F1F5F9', fontWeight: 800, fontSize: 20, marginBottom: 20 }}>
          購物車（{items.length} 件）
        </h2>

        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '64px 0', color: '#64748B' }}>
            <ShoppingCart size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ fontWeight: 600 }}>購物車是空的</p>
            <button
              onClick={() => navigate('/market')}
              style={{ marginTop: 16, color: '#8B5CF6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
            >
              去逛逛 →
            </button>
          </div>
        ) : (
          <>
            {items.map(item => {
              const inactive = item.listing.status !== 'active';
              return (
                <div key={item.id} style={{
                  display: 'flex', gap: 12, alignItems: 'center',
                  background: 'rgba(255,255,255,0.04)', borderRadius: 14,
                  padding: '12px 14px', marginBottom: 10,
                  border: '1px solid rgba(255,255,255,0.07)',
                  opacity: inactive ? 0.5 : 1,
                }}>
                  <img
                    src={item.listing.cardImage}
                    style={{ width: 44, height: 60, borderRadius: 8, objectFit: 'cover', background: 'rgba(255,255,255,0.06)' }}
                    alt={item.listing.cardName}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: '#F1F5F9', fontWeight: 700, fontSize: 14, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.listing.cardName}
                    </p>
                    <p style={{ color: '#64748B', fontSize: 12 }}>
                      {item.listing.condition} ×{item.quantity}{'　'}
                      <span style={{ color: '#A78BFA', fontWeight: 700 }}>
                        NT${(item.listing.price * item.quantity).toLocaleString()}
                      </span>
                      {inactive && <span style={{ color: '#EF4444', marginLeft: 6 }}>已售出</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => remove(item.listingId)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 6 }}
                    aria-label="移除"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}

            <div style={{
              background: 'rgba(139,92,246,0.08)', borderRadius: 16,
              padding: '16px', marginTop: 16, border: '1px solid rgba(139,92,246,0.2)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ color: '#94A3B8', fontWeight: 600, fontSize: 14 }}>合計</span>
                <span style={{ color: '#A78BFA', fontWeight: 900, fontSize: 22 }}>
                  NT${total.toLocaleString()}
                </span>
              </div>
              {hasInactive && (
                <p style={{ color: '#F59E0B', fontSize: 12, marginBottom: 10 }}>部分商品已售出，請先移除再結帳</p>
              )}
              <button
                onClick={() => navigate('/checkout')}
                disabled={hasInactive}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12,
                  background: hasInactive ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg,#8B5CF6,#7C3AED)',
                  color: '#fff', fontWeight: 800, fontSize: 16,
                  border: 'none', cursor: hasInactive ? 'not-allowed' : 'pointer',
                }}
              >
                前往結帳
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

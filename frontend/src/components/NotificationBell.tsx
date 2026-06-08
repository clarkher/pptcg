import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../api/notifications';
import { useAuthStore } from '../stores/authStore';
import type { NotificationItem } from '../types/catalog';

export function NotificationBell() {
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);

  const load = () => {
    if (!token) return;
    notificationsApi.mine().then(setItems).catch(() => setItems([]));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  if (!token) return null;
  const unread = items.filter((i) => !i.read).length;

  const onItemClick = async (n: NotificationItem) => {
    if (!n.read) { try { await notificationsApi.markRead(n.id); } catch { /* ignore */ } }
    setOpen(false);
    navigate(`/card/${encodeURIComponent(n.cardId)}`);
    load();
  };

  const markAll = async () => { try { await notificationsApi.markAllRead(); load(); } catch { /* ignore */ } };

  return (
    <div style={{ position: 'fixed', top: 14, right: 16, zIndex: 60 }}>
      <button onClick={() => { setOpen((v) => !v); if (!open) load(); }} style={{
        position: 'relative', width: 40, height: 40, borderRadius: 12, cursor: 'pointer',
        background: 'rgba(6,6,15,0.9)', border: '1px solid rgba(167,139,250,0.2)',
        backdropFilter: 'blur(12px)', color: '#A78BFA', fontSize: 18,
      }}>
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, padding: '0 4px',
            borderRadius: 9, background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 48, right: 0, width: 300, maxHeight: 400, overflowY: 'auto',
          background: 'rgba(10,10,20,0.98)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 14,
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)', padding: 8,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#F1F5F9' }}>通知</span>
            {unread > 0 && <button onClick={markAll} style={{ background: 'none', border: 'none', color: '#60A5FA', fontSize: 11, cursor: 'pointer' }}>全部已讀</button>}
          </div>
          {items.length === 0 ? (
            <p style={{ fontSize: 12, color: '#64748B', padding: 16, textAlign: 'center' }}>目前沒有通知</p>
          ) : items.map((n) => (
            <button key={n.id} onClick={() => onItemClick(n)} style={{
              display: 'flex', gap: 10, alignItems: 'center', width: '100%', textAlign: 'left',
              padding: '8px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: n.read ? 'transparent' : 'rgba(96,165,250,0.08)', marginBottom: 2,
            }}>
              {n.cardImage && <img src={n.cardImage} alt="" style={{ width: 32, height: 44, objectFit: 'contain', borderRadius: 4 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, color: '#E2E8F0', lineHeight: 1.4 }}>{n.message}</p>
                <p style={{ fontSize: 10, color: '#64748B', marginTop: 2 }}>{new Date(n.createdAt).toLocaleString('zh-TW')}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

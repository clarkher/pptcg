import { api } from './client';
import type { Listing } from '../types';

export interface AdminStats {
  totalListings: number;
  activeListings: number;
  totalOrders: number;
  pendingOrders: number;
  totalUsers: number;
  revenue: number;
}

export interface AdminOrderItem {
  quantity: number;
  price: number;
  listing: { cardName: string; cardImage: string };
}

export interface AdminOrder {
  id: string;
  merchantTradeNo: string;
  total: number;
  paymentMethod: string; // 'credit' | 'cvs' | 'cvs_cod'
  paymentStatus: string;
  status: string;
  items: AdminOrderItem[];
  buyer: { username: string; email: string };
  createdAt: string;
  refundedAt?: string;
  refundNote?: string;
}

type ListingInput = Partial<Listing & { status: string }>;

export const adminApi = {
  getStats: () => api.get<AdminStats>('/admin/stats').then((r) => r.data),
  getListings: () => api.get<Listing[]>('/admin/listings').then((r) => r.data),
  createListing: (data: ListingInput) => api.post<Listing>('/admin/listings', data).then((r) => r.data),
  updateListing: (id: string, data: ListingInput) => api.patch<Listing>(`/admin/listings/${id}`, data).then((r) => r.data),
  deleteListing: (id: string) => api.delete(`/admin/listings/${id}`).then((r) => r.data),
  getOrders: () => api.get<AdminOrder[]>('/admin/orders').then((r) => r.data),
  updateOrder: (id: string, status: string) => api.patch<AdminOrder>(`/admin/orders/${id}`, { status }).then((r) => r.data),
  refundOrder: (id: string, note?: string) =>
    api.post<{ ok: boolean; note?: string }>(`/admin/orders/${id}/refund`, { note }).then((r) => r.data),

  // ── Catalog 管理 ──
  catalog: (params: Record<string, unknown>) => api.get('/admin/catalog', { params }).then((r) => r.data),
  createInventory: (data: Record<string, unknown>) => api.post('/admin/inventory', data).then((r) => r.data),
  updateInventory: (id: string, data: Record<string, unknown>) => api.patch(`/admin/inventory/${id}`, data).then((r) => r.data),
  deleteInventory: (id: string) => api.delete(`/admin/inventory/${id}`).then((r) => r.data),
  cardWishlist: (cardId: string) => api.get('/admin/wishlist', { params: { cardId } }).then((r) => r.data),
  wishlistOverview: () => api.get('/admin/wishlist-overview').then((r) => r.data),
  updateCard: (id: string, data: Record<string, unknown>) => api.patch(`/admin/cards/${encodeURIComponent(id)}`, data).then((r) => r.data),
  createCard: (data: Record<string, unknown>) => api.post('/admin/cards', data).then((r) => r.data),
  orphanListings: () => api.get('/admin/orphan-listings').then((r) => r.data),

  // ── 參照資料 ──
  rarities: () => api.get('/admin/rarities').then((r) => r.data),
  createRarity: (d: Record<string, unknown>) => api.post('/admin/rarities', d).then((r) => r.data),
  updateRarity: (id: string, d: Record<string, unknown>) => api.patch(`/admin/rarities/${id}`, d).then((r) => r.data),
  deleteRarity: (id: string) => api.delete(`/admin/rarities/${id}`).then((r) => r.data),
  conditions: () => api.get('/admin/conditions').then((r) => r.data),
  createCondition: (d: Record<string, unknown>) => api.post('/admin/conditions', d).then((r) => r.data),
  updateCondition: (id: string, d: Record<string, unknown>) => api.patch(`/admin/conditions/${id}`, d).then((r) => r.data),
  deleteCondition: (id: string) => api.delete(`/admin/conditions/${id}`).then((r) => r.data),
  seriesDefs: (language?: string) => api.get('/admin/series-defs', { params: { language } }).then((r) => r.data),
  createSeriesDef: (d: Record<string, unknown>) => api.post('/admin/series-defs', d).then((r) => r.data),
  updateSeriesDef: (id: string, d: Record<string, unknown>) => api.patch(`/admin/series-defs/${id}`, d).then((r) => r.data),
  deleteSeriesDef: (id: string) => api.delete(`/admin/series-defs/${id}`).then((r) => r.data),
};

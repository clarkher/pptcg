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

export interface AdminOrder {
  id: string;
  listing: Listing;
  buyer: { username: string; email: string };
  seller: { username: string };
  quantity: number;
  total: number;
  status: string;
  createdAt: string;
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
};

import { api } from './client';
import type { CartItem } from '../types';

export const cartApi = {
  get: async (): Promise<CartItem[]> => {
    const { data } = await api.get('/cart');
    return data;
  },
  add: async (listingId: string, quantity = 1): Promise<CartItem> => {
    const { data } = await api.post('/cart', { listingId, quantity });
    return data;
  },
  setQuantity: async (listingId: string, quantity: number): Promise<CartItem> => {
    const { data } = await api.patch(`/cart/${listingId}`, { quantity });
    return data;
  },
  remove: async (listingId: string): Promise<void> => {
    await api.delete(`/cart/${listingId}`);
  },
  clear: async (): Promise<void> => {
    await api.delete('/cart');
  },
};

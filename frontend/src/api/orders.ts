import { api } from './client';
import type { Order } from '../types';

export const ordersApi = {
  buy: async (listingId: string, quantity: number): Promise<Order> => {
    const { data } = await api.post('/orders', { listingId, quantity });
    return data;
  },
  getMine: async (): Promise<Order[]> => {
    const { data } = await api.get('/orders/mine');
    return data;
  },
};

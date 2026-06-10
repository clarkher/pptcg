import { api } from './client';
import type { Order } from '../types';

export const ordersApi = {
  getMine: async (): Promise<Order[]> => {
    const { data } = await api.get('/orders/mine');
    return data;
  },
  getByTradeNo: async (tradeNo: string): Promise<Order> => {
    const { data } = await api.get(`/orders/by-trade-no/${tradeNo}`);
    return data;
  },
};

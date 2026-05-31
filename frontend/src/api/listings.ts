import { api } from './client';
import type { Listing } from '../types';

export const listingsApi = {
  getAll: async (params?: { game?: string; q?: string }): Promise<Listing[]> => {
    const { data } = await api.get('/listings', { params });
    return data;
  },
  getMine: async (): Promise<Listing[]> => {
    const { data } = await api.get('/listings/mine');
    return data;
  },
  create: async (payload: {
    cardId: string;
    cardName: string;
    cardGame: string;
    cardImage: string;
    condition: string;
    price: number;
    quantity: number;
    description?: string;
  }): Promise<Listing> => {
    const { data } = await api.post('/listings', payload);
    return data;
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(`/listings/${id}`);
  },
};

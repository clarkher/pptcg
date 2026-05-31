import { api } from './client';
import type { Card } from '../types';

export const cardsApi = {
  searchYugioh: async (name?: string): Promise<Card[]> => {
    const { data } = await api.get('/cards/yugioh', { params: name ? { name } : {} });
    return data;
  },
  searchPokemon: async (name?: string): Promise<Card[]> => {
    const { data } = await api.get('/cards/pokemon', { params: name ? { name } : {} });
    return data;
  },
};

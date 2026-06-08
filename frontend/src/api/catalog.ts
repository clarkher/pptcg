import { api } from './client';
import type { CatalogCard, CatalogCardDetail, RarityDef, ConditionDef, SeriesDef } from '../types/catalog';

export interface SetInfo { id: string; name: string; logo: string | null; releaseDate: string | null; language: string; seriesKey: string; count: number; }

export const catalogApi = {
  cards: (params: { language?: string; seriesKey?: string; setId?: string; q?: string; inStock?: boolean; sort?: string; page?: number; limit?: number }) =>
    api.get<{ cards: CatalogCard[]; total: number; page: number; pages: number }>('/catalog/cards', { params }).then((r) => r.data),
  card: (id: string) =>
    api.get<CatalogCardDetail>(`/catalog/cards/${encodeURIComponent(id)}`).then((r) => r.data),
  rarities: () => api.get<RarityDef[]>('/catalog/rarities').then((r) => r.data),
  conditions: () => api.get<ConditionDef[]>('/catalog/conditions').then((r) => r.data),
  series: (language: string) => api.get<SeriesDef[]>('/pokemon/series', { params: { language } }).then((r) => r.data),
  sets: (language: string, seriesKey: string) => api.get<SetInfo[]>('/pokemon/sets', { params: { language, seriesKey } }).then((r) => r.data),
};

import { api } from './client';

export type CardLanguage = 'en' | 'ja' | 'zh';

export interface PokemonCard {
  id: string;
  language: CardLanguage;
  setId: string;
  setName: string;
  seriesKey: string;
  seriesName: string;
  setLogo: string | null;
  releaseDate: string | null;
  number: string;
  name: string;
  image: string;
  imageHigh: string | null;
  rarity: string | null;
  hp: string | null;
  types: string | null;
  supertype: string | null;
}

export interface CardSearchResult {
  cards: PokemonCard[];
  total: number;
  page: number;
  pages: number;
}

export interface SeriesInfo {
  key: string;
  name: string;
  language: CardLanguage;
  count: number;
}

export interface SetInfo {
  id: string;
  name: string;
  logo: string | null;
  releaseDate: string | null;
  language: CardLanguage;
  seriesKey: string;
  count: number;
}

export interface DbStats {
  en: number;
  ja: number;
  zh: number;
  total: number;
}

export const pokemonApi = {
  search: (params: { q?: string; language?: CardLanguage; seriesKey?: string; setId?: string; page?: number }) =>
    api.get<CardSearchResult>('/pokemon/search', { params: { ...params, limit: 24 } }).then(r => r.data),

  series: (language: CardLanguage) =>
    api.get<SeriesInfo[]>('/pokemon/series', { params: { language } }).then(r => r.data),

  sets: (language: CardLanguage, seriesKey?: string) =>
    api.get<SetInfo[]>('/pokemon/sets', { params: { language, seriesKey } }).then(r => r.data),

  stats: () =>
    api.get<DbStats>('/pokemon/stats').then(r => r.data),
};

export const LANG_LABELS: Record<CardLanguage, string> = {
  en: '🇺🇸 英版',
  ja: '🇯🇵 日版',
  zh: '🇹🇼 中文版',
};

export const LANG_COLORS: Record<CardLanguage, string> = {
  en: '#60A5FA',
  ja: '#F87171',
  zh: '#34D399',
};

import { api } from './client';

export interface PokemonCard {
  id: string;
  name: string;
  number: string;
  imageSmall: string;
  imageLarge: string;
  rarity: string | null;
  setId: string;
  setName: string;
  setSeries: string;
  releaseDate: string;
  types: string | null;
  hp: string | null;
}

export interface CardSearchResult {
  cards: PokemonCard[];
  total: number;
  page: number;
  pages: number;
}

export const pokemonApi = {
  search: (q: string, page = 1, setId?: string) =>
    api.get<CardSearchResult>('/pokemon/search', { params: { q, page, limit: 24, setId } }).then(r => r.data),
  sets: () =>
    api.get<{ setId: string; setName: string; setSeries: string; releaseDate: string }[]>('/pokemon/sets').then(r => r.data),
  stats: () =>
    api.get<{ total: number; sets: number }>('/pokemon/stats').then(r => r.data),
};

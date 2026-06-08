import { api } from './client';
import type { WishlistItem } from '../types/catalog';

export const wishlistApi = {
  add: (cardId: string, variant?: string | null) =>
    api.post('/wishlist', { cardId, variant: variant ?? null }).then((r) => r.data),
  remove: (cardId: string, variant?: string | null) =>
    api.delete('/wishlist', { data: { cardId, variant: variant ?? null } }).then((r) => r.data),
  mine: () => api.get<WishlistItem[]>('/wishlist/mine').then((r) => r.data),
};

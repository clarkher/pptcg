import { create } from 'zustand';
import type { CartItem } from '../types';
import { cartApi } from '../api/cart';

interface CartState {
  items: CartItem[];
  loading: boolean;
  fetch: () => Promise<void>;
  add: (listingId: string, quantity?: number) => Promise<void>;
  remove: (listingId: string) => Promise<void>;
  clear: () => Promise<void>;
  reset: () => void;
}

export const useCartStore = create<CartState>()((set, get) => ({
  items: [],
  loading: false,
  fetch: async () => {
    set({ loading: true });
    try {
      const items = await cartApi.get();
      set({ items });
    } finally {
      set({ loading: false });
    }
  },
  add: async (listingId, quantity = 1) => {
    await cartApi.add(listingId, quantity);
    await get().fetch();
  },
  remove: async (listingId) => {
    await cartApi.remove(listingId);
    set(s => ({ items: s.items.filter(i => i.listingId !== listingId) }));
  },
  clear: async () => {
    await cartApi.clear();
    set({ items: [] });
  },
  reset: () => set({ items: [] }),
}));

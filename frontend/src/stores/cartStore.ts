import { create } from 'zustand';
import type { CartItem } from '../types';
import { cartApi } from '../api/cart';
import { trackPixel } from '../lib/analytics';

interface CartState {
  items: CartItem[];
  loading: boolean;
  fetch: () => Promise<void>;
  add: (listingId: string, quantity?: number) => Promise<void>;
  setQuantity: (listingId: string, quantity: number) => Promise<void>;
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
    const item = get().items.find((i) => i.listingId === listingId);
    if (item) {
      trackPixel('AddToCart', {
        content_type: 'product',
        content_ids: [listingId],
        content_name: item.listing.cardName,
        currency: 'TWD',
        value: item.listing.price * quantity,
      });
    }
  },
  setQuantity: async (listingId, quantity) => {
    // 樂觀更新：先動 UI（步進器即時回應、連點讀到最新值），再用伺服器夾擠後的值校正
    set(s => ({ items: s.items.map(i => i.listingId === listingId ? { ...i, quantity } : i) }));
    try {
      const updated = await cartApi.setQuantity(listingId, quantity);
      set(s => ({ items: s.items.map(i => i.listingId === listingId ? { ...i, quantity: updated.quantity } : i) }));
    } catch {
      await get().fetch();
    }
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

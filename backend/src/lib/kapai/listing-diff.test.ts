import { describe, it, expect } from 'vitest';
import { listingChanged } from './logic';

describe('listingChanged', () => {
  it('新掛單（無現有）→ 需寫入', () => {
    expect(listingChanged(undefined, { price: 100, stock: 1 })).toBe(true);
    expect(listingChanged(null, { price: 100, stock: 1 })).toBe(true);
  });
  it('價格有變 → 需寫入', () => {
    expect(listingChanged({ price: 100, stock: 1 }, { price: 90, stock: 1 })).toBe(true);
  });
  it('庫存有變 → 需寫入', () => {
    expect(listingChanged({ price: 100, stock: 2 }, { price: 100, stock: 1 })).toBe(true);
  });
  it('價量都沒變 → 跳過（false）', () => {
    expect(listingChanged({ price: 100, stock: 1 }, { price: 100, stock: 1 })).toBe(false);
  });
});

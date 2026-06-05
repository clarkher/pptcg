import { describe, it, expect } from 'vitest';
import { aggregateInventory, type InventoryRow } from './inventory';

const rows = (...r: Partial<InventoryRow>[]): InventoryRow[] =>
  r.map((x) => ({ cardId: 'c1', variant: '標準', condition: 'NM', price: 100, quantity: 1, ...x }));

describe('aggregateInventory', () => {
  it('回傳空彙整當無庫存', () => {
    expect(aggregateInventory([])).toEqual({ minPrice: null, totalQty: 0, variantCount: 0 });
  });

  it('單筆庫存', () => {
    expect(aggregateInventory(rows({ price: 120, quantity: 3 }))).toEqual({
      minPrice: 120, totalQty: 3, variantCount: 1,
    });
  });

  it('多變體取最低價、加總數量、算 distinct 變體數', () => {
    const agg = aggregateInventory(rows(
      { variant: '普通', price: 100, quantity: 2 },
      { variant: '反射閃', price: 80, quantity: 1 },
      { variant: '反射閃', price: 90, quantity: 4 },
    ));
    expect(agg).toEqual({ minPrice: 80, totalQty: 7, variantCount: 2 });
  });

  it('忽略數量為 0 的庫存於 totalQty 但仍可計入變體', () => {
    const agg = aggregateInventory(rows(
      { variant: '普通', price: 100, quantity: 0 },
      { variant: '異圖', price: 300, quantity: 2 },
    ));
    expect(agg.totalQty).toBe(2);
    expect(agg.minPrice).toBe(300);
    expect(agg.variantCount).toBe(2);
  });
});

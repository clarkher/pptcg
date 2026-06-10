import { describe, it, expect } from 'vitest';
import {
  aggregateInventory, becameRestocked, clampCartSet, decrementStock,
  type InventoryRow,
} from './inventory';

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

describe('clampCartSet（購物車設定絕對數量）', () => {
  it('夾到 1..庫存', () => {
    expect(clampCartSet(3, 5)).toBe(3);
    expect(clampCartSet(9, 5)).toBe(5);
    expect(clampCartSet(0, 5)).toBe(1);
    expect(clampCartSet(-2, 5)).toBe(1);
  });
  it('非數字 → 1', () => {
    expect(clampCartSet(NaN as unknown as number, 5)).toBe(1);
  });
});

describe('decrementStock（售出後扣庫存）', () => {
  it('買 2 / 庫存 5 → 剩 3，維持 active', () => {
    expect(decrementStock(5, 2)).toEqual({ quantity: 3, status: 'active' });
  });
  it('買到剛好 0 → 標 sold', () => {
    expect(decrementStock(2, 2)).toEqual({ quantity: 0, status: 'sold' });
  });
  it('買超過庫存 → 夾到 0、標 sold', () => {
    expect(decrementStock(1, 3)).toEqual({ quantity: 0, status: 'sold' });
  });
  it('買 1 / 庫存 1 → sold（不是整筆消失剩餘）', () => {
    expect(decrementStock(1, 1)).toEqual({ quantity: 0, status: 'sold' });
  });
});

describe('becameRestocked', () => {
  it('0 → 正數 視為補貨', () => {
    expect(becameRestocked(0, 5)).toBe(true);
  });
  it('正數 → 正數 不算補貨', () => {
    expect(becameRestocked(3, 8)).toBe(false);
  });
  it('正數 → 0 不算補貨', () => {
    expect(becameRestocked(5, 0)).toBe(false);
  });
  it('0 → 0 不算補貨', () => {
    expect(becameRestocked(0, 0)).toBe(false);
  });
});

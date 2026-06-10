export interface InventoryRow {
  cardId: string;
  variant: string;
  condition: string;
  price: number;
  quantity: number;
}

export interface InventoryAgg {
  minPrice: number | null;
  totalQty: number;
  variantCount: number;
}

export function aggregateInventory(rows: InventoryRow[]): InventoryAgg {
  if (rows.length === 0) return { minPrice: null, totalQty: 0, variantCount: 0 };
  const inStock = rows.filter((r) => r.quantity > 0);
  const minPrice = inStock.length ? Math.min(...inStock.map((r) => r.price)) : null;
  const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
  const variantCount = new Set(rows.map((r) => r.variant)).size;
  return { minPrice, totalQty, variantCount };
}

export function becameRestocked(prevTotalQty: number, nextTotalQty: number): boolean {
  return prevTotalQty <= 0 && nextTotalQty > 0;
}

/** 購物車步進器：設定絕對數量，夾擠到 1..庫存。 */
export function clampCartSet(quantity: number, stock: number): number {
  const q = Math.floor(Number(quantity));
  if (!Number.isFinite(q)) return 1;
  return Math.max(1, Math.min(q, stock));
}

/**
 * 售出後扣庫存：回新數量與狀態。數量 <= 0 才標 sold，否則維持 active。
 * （修掉原本不論買幾件都把整筆 listing 標 sold、剩餘庫存消失的問題）
 */
export function decrementStock(current: number, bought: number): { quantity: number; status: string } {
  const next = Math.max(0, Math.floor(current) - Math.max(0, Math.floor(bought)));
  return { quantity: next, status: next <= 0 ? 'sold' : 'active' };
}

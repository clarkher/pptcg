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

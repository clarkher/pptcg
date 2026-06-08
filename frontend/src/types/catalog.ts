export interface CatalogCard {
  id: string;
  name: string;
  number: string;
  image: string;
  imageHigh: string | null;
  rarity: string | null;
  language: string;
  seriesKey: string;
  seriesName: string;
  setId: string;
  setName: string;
  minPrice: number | null;
  totalQty: number;
  variantCount: number;
  wishlistCount: number;
}

export interface CardVariantRow {
  listingId: string;
  variant: string;
  condition: string;
  price: number;
  quantity: number;
}

export interface CatalogCardDetail {
  id: string;
  name: string;
  number: string;
  image: string;
  imageHigh: string | null;
  rarity: string | null;
  language: string;
  seriesKey: string;
  seriesName: string;
  setId: string;
  setName: string;
  hp: string | null;
  types: string | null;
  supertype: string | null;
  variants: CardVariantRow[];
  wishlistCount: number;
  userWished: boolean;
}

export interface RarityDef { id: string; code: string; label: string; color: string; sortOrder: number; }
export interface ConditionDef { id: string; code: string; label: string; sortOrder: number; }
export interface SeriesDef { id: string; key: string; name: string; language: string; logo: string | null; sortOrder: number; }

export interface NotificationItem {
  id: string; type: string; cardId: string; cardName: string; cardImage: string;
  message: string; read: boolean; createdAt: string;
}

export interface WishlistItem {
  id: string; cardId: string; cardName: string; cardImage: string;
  language: string; variant: string | null; createdAt: string;
}

// 後台庫存行（adminCatalog 回傳的 listing select 形狀）
export interface AdminInventoryRow {
  id: string;
  cardId: string;
  variant: string;
  condition: string;
  price: number;
  quantity: number;
}

// 後台 catalog 卡片（含庫存與敲碗數）
export interface AdminCatalogCard extends CatalogCard {
  inventory: AdminInventoryRow[];
}

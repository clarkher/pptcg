export interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  isAdmin?: boolean;
  lineBound?: boolean;
}

export interface Card {
  id: string;
  name: string;
  game: 'yugioh' | 'pokemon';
  image?: string;
  type?: string;
  desc?: string;
  set?: string;
}

export interface Listing {
  id: string;
  cardId: string;
  cardName: string;
  cardGame: 'yugioh' | 'pokemon';
  cardImage: string;
  condition: string;
  price: number;
  quantity: number;
  description?: string;
  language?: string;
  status: string;
  createdAt: string;
  seller: { username: string; avatar?: string };
}

export interface CartItem {
  id: string;
  listingId: string;
  quantity: number;
  listing: {
    id: string;
    cardName: string;
    cardImage: string;
    price: number;
    quantity: number;
    status: string;
    condition: string;
    language: string;
    seller: { username: string };
  };
}

export interface OrderItem {
  id: string;
  listingId: string;
  quantity: number;
  price: number;
  listing: {
    cardName: string;
    cardImage: string;
    condition: string;
    language: string;
  };
}

export interface Order {
  id: string;
  merchantTradeNo: string;
  total: number;
  paymentMethod: 'credit' | 'cvs' | 'cvs_cod';
  paymentStatus: 'pending' | 'paid' | 'failed';
  status: 'pending_payment' | 'paid' | 'shipped' | 'completed' | 'cancelled' | 'refunded';
  ecpayTradeNo?: string;
  cvsPaymentCode?: string;
  cvsExpireDate?: string;
  storeName?: string;
  receiverName?: string;
  refundedAt?: string;
  refundNote?: string;
  items: OrderItem[];
  createdAt: string;
}

export type Game = 'yugioh' | 'pokemon' | 'all';
export type Condition = 'NM' | 'LP' | 'MP' | 'HP';

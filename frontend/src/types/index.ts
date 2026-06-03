export interface User {
  id: string;
  email: string;
  username: string;
  wallet: number;
  avatar?: string;
  isAdmin?: boolean;
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
  condition: 'NM' | 'LP' | 'MP' | 'HP';
  price: number;
  quantity: number;
  description?: string;
  language?: string;
  status: string;
  createdAt: string;
  seller: { username: string; avatar?: string };
}

export interface Order {
  id: string;
  quantity: number;
  total: number;
  status: string;
  createdAt: string;
  listing: Listing;
  seller: { username: string };
}

export type Game = 'yugioh' | 'pokemon' | 'all';
export type Condition = 'NM' | 'LP' | 'MP' | 'HP';

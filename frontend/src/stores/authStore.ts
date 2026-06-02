import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { api } from '../api/client';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        localStorage.setItem('pptcg_token', data.token);
        set({ user: data.user, token: data.token });
      },
      loginWithGoogle: async (credential) => {
        const { data } = await api.post('/auth/google', { credential });
        localStorage.setItem('pptcg_token', data.token);
        set({ user: data.user, token: data.token });
      },
      register: async (email, username, password) => {
        const { data } = await api.post('/auth/register', { email, username, password });
        localStorage.setItem('pptcg_token', data.token);
        set({ user: data.user, token: data.token });
      },
      logout: () => {
        localStorage.removeItem('pptcg_token');
        set({ user: null, token: null });
      },
      refreshUser: async () => {
        try {
          const { data } = await api.get('/auth/me');
          set({ user: data });
        } catch {
          // token expired, ignore
        }
      },
    }),
    {
      name: 'pptcg_auth',
      partialize: (s) => ({ token: s.token, user: s.user }),
    }
  )
);

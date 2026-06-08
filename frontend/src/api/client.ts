import axios from 'axios';

// API base URL (亦供少數需直接 fetch 的頁面使用，如後台設定)
export const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: apiBase,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pptcg_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('pptcg_token');
    }
    return Promise.reject(err);
  }
);

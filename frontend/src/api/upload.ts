import { api } from './client';

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<{ url: string }>('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.url;
}

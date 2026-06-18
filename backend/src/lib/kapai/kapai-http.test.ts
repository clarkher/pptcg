import { describe, it, expect, afterEach } from 'vitest';
import { kapaiBase, kapaiHeaders } from './kapai-http';

afterEach(() => {
  delete process.env.KAPAI_API_BASE;
  delete process.env.KAPAI_PROXY_SECRET;
});

describe('kapaiBase', () => {
  it('預設直連 kapaipai', () => {
    delete process.env.KAPAI_API_BASE;
    expect(kapaiBase()).toBe('https://trade.kapaipai.tw/api');
  });
  it('KAPAI_API_BASE 覆寫成代理網址', () => {
    process.env.KAPAI_API_BASE = 'https://proxy.example/api';
    expect(kapaiBase()).toBe('https://proxy.example/api');
  });
});

describe('kapaiHeaders', () => {
  it('無 secret 只帶 UA', () => {
    delete process.env.KAPAI_PROXY_SECRET;
    const h = kapaiHeaders();
    expect(h['User-Agent']).toContain('Mozilla');
    expect(h.Authorization).toBeUndefined();
  });
  it('有 secret 帶 Bearer 金鑰', () => {
    process.env.KAPAI_PROXY_SECRET = 'abc123';
    expect(kapaiHeaders().Authorization).toBe('Bearer abc123');
  });
});

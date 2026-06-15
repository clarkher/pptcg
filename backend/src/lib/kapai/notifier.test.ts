import { describe, it, expect } from 'vitest';
import { buildText, type AlertListing } from './notifier';

const sample: AlertListing = {
  id: 1, game: 'pkmjp', name: '皮卡丘', packName: '測試包', cardKey: 'SV2a-025',
  condition: 'perfect', price: 800, sellerId: 9, sellerNickname: '賣家', sellerArea: '台北',
};

describe('buildText', () => {
  it('預設用套利雷達標頭', () => {
    expect(buildText(sample, 1200)).toContain('🚨 套利雷達');
  });
  it('surge 用行情跳漲標頭', () => {
    const t = buildText(sample, 1200, { surge: true });
    expect(t).toContain('🔥 行情跳漲撿漏');
    expect(t).not.toContain('🚨 套利雷達');
  });
  it('仍顯示售價與省額', () => {
    expect(buildText(sample, 1200)).toContain('省 NT$400');
  });
});

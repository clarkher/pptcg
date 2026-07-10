import { describe, it, expect } from 'vitest';
import { analyzeNote } from './logic';

describe('analyzeNote', () => {
  it('隨機出貨 → suppress（不是這張卡）', () => {
    const f = analyzeNote('sv11w/m2a系列隨機出');
    expect(f.suppress).toBe(true);
  });
  it('A品 → warn', () => expect(analyzeNote('A品').warn).toBe(true));
  it('打牌品 → warn', () => expect(analyzeNote('裸卡請視為打牌品，歡迎私我看細圖').warn).toBe(true));
  it('歲月痕跡 → warn', () => expect(analyzeNote('（古董收藏用，可能有些微歲月痕跡）').warn).toBe(true));
  it('缺角 → warn', () => expect(analyzeNote('右下缺角').warn).toBe(true));
  it('完美無損 不算 warn', () => expect(analyzeNote('完美無損').warn).toBe(false));
  it('有附卡套 → 乾淨', () => {
    const f = analyzeNote('有附卡套');
    expect(f.suppress).toBe(false);
    expect(f.warn).toBe(false);
  });
  it('空備註 → 乾淨', () => {
    const f = analyzeNote('');
    expect(f.suppress).toBe(false);
    expect(f.warn).toBe(false);
  });
});

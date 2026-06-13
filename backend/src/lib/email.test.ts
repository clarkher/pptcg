import { describe, it, expect } from 'vitest';
import { verificationEmailHtml, resetPasswordEmailHtml } from './email';

describe('verificationEmailHtml', () => {
  it('包含連結、品牌、與 24 小時字樣', () => {
    const html = verificationEmailHtml('https://x.com/verify-email?token=abc');
    expect(html).toContain('https://x.com/verify-email?token=abc');
    expect(html).toContain('屁TCG');
    expect(html).toContain('24');
  });
});

describe('resetPasswordEmailHtml', () => {
  it('包含連結與重設字樣', () => {
    const html = resetPasswordEmailHtml('https://x.com/reset-password?token=abc');
    expect(html).toContain('https://x.com/reset-password?token=abc');
    expect(html).toContain('重設');
  });
});

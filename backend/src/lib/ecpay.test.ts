import { describe, it, expect } from 'vitest';
import { generateCheckMacValue, verifyCheckMacValue } from './ecpay';

const HASH_KEY = 'pwFHCqoQZGmho4w6';
const HASH_IV = 'EkRm7iFT261dpevs';

describe('generateCheckMacValue (SHA256)', () => {
  it('matches official AIO base vector', () => {
    const params = {
      MerchantID: '3002607',
      MerchantTradeNo: 'Test1234567890',
      MerchantTradeDate: '2025/01/01 12:00:00',
      PaymentType: 'aio',
      TotalAmount: '100',
      TradeDesc: '測試',
      ItemName: '測試商品',
      ReturnURL: 'https://example.com/notify',
      ChoosePayment: 'ALL',
      EncryptType: '1',
    };
    expect(generateCheckMacValue(params, HASH_KEY, HASH_IV))
      .toBe('291CBA324D31FB5A4BBBFDF2CFE5D32598524753AFD4959C3BF590C5B2F57FB2');
  });

  it("handles apostrophe ' correctly", () => {
    const params = { MerchantID: '3002607', ItemName: "Tom's Shop", TotalAmount: '100' };
    expect(generateCheckMacValue(params, HASH_KEY, HASH_IV))
      .toBe('CF0A3D4901D99459D8641516EC57210700E8A5C9AB26B1D021301E9CB93EF78D');
  });

  it('handles tilde ~ correctly', () => {
    const params = { MerchantID: '3002607', ItemName: 'Test~Product', TotalAmount: '200' };
    expect(generateCheckMacValue(params, HASH_KEY, HASH_IV))
      .toBe('CEEAE01D2F9A8E74D4AC0DCE7735B046D73F35A5EC99558A31A2EE03159DA1C9');
  });

  it('encodes space as + not %20', () => {
    const params = { MerchantID: '3002607', ItemName: 'My Test Product', TotalAmount: '300' };
    expect(generateCheckMacValue(params, HASH_KEY, HASH_IV))
      .toBe('7712A5E6EDC3B57086063C88568084C66CE882A21D40E74DE5ACA3B478C6F316');
  });

  it('excludes existing CheckMacValue from calculation', () => {
    const base = { MerchantID: '3002607', ItemName: 'Test~Product', TotalAmount: '200' };
    const withCmv = { ...base, CheckMacValue: 'SHOULD_BE_IGNORED' };
    expect(generateCheckMacValue(withCmv, HASH_KEY, HASH_IV))
      .toBe(generateCheckMacValue(base, HASH_KEY, HASH_IV));
  });
});

describe('verifyCheckMacValue', () => {
  it('returns true for a valid CMV', () => {
    const params: Record<string,string> = { MerchantID: '3002607', ItemName: 'Test~Product', TotalAmount: '200' };
    params.CheckMacValue = generateCheckMacValue(params, HASH_KEY, HASH_IV);
    expect(verifyCheckMacValue(params, HASH_KEY, HASH_IV)).toBe(true);
  });
  it('returns false for a tampered CMV', () => {
    const params = { MerchantID: '3002607', ItemName: 'Test~Product', TotalAmount: '200', CheckMacValue: 'WRONG' };
    expect(verifyCheckMacValue(params, HASH_KEY, HASH_IV)).toBe(false);
  });
});

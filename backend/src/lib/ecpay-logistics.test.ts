import { describe, it, expect } from 'vitest';
import { buildStoreMapParams, type LogisticsConfig } from './ecpay-logistics';

const config: LogisticsConfig = {
  merchantId: '2000132',
  hashKey: '5294y06JbISpM5x9',
  hashIv: 'v77hoKGq4kWxNNIS',
  isStaging: true,
};

describe('buildStoreMapParams', () => {
  it('maps UNIMART to UNIMARTC2C subtype and includes a CheckMacValue', () => {
    const { url, params } = buildStoreMapParams(
      { shippingType: 'UNIMART', serverReplyUrl: 'https://x/cb', extraData: 'abc123' },
      config,
    );
    expect(params.LogisticsSubType).toBe('UNIMARTC2C');
    expect(params.LogisticsType).toBe('CVS');
    expect(params.IsCollection).toBe('Y');
    expect(params.ExtraData).toBe('abc123');
    expect(params.CheckMacValue).toMatch(/^[0-9A-F]{32}$/); // MD5 = 32 hex upper
    expect(url).toBe('https://logistics-stage.ecpay.com.tw/Express/map');
  });

  it('maps FAMI and HILIFE to their C2C subtypes', () => {
    const fami = buildStoreMapParams({ shippingType: 'FAMI', serverReplyUrl: 'u', extraData: 'e' }, config);
    const hilife = buildStoreMapParams({ shippingType: 'HILIFE', serverReplyUrl: 'u', extraData: 'e' }, config);
    expect(fami.params.LogisticsSubType).toBe('FAMIC2C');
    expect(hilife.params.LogisticsSubType).toBe('HILIFEC2C');
  });

  it('uses production URL when not staging', () => {
    const { url } = buildStoreMapParams(
      { shippingType: 'UNIMART', serverReplyUrl: 'u', extraData: 'e' },
      { ...config, isStaging: false },
    );
    expect(url).toBe('https://logistics.ecpay.com.tw/Express/map');
  });
});

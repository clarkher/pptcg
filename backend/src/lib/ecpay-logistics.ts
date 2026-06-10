import { generateCheckMacValue, getMerchantTradeDate } from './ecpay';

export interface LogisticsConfig {
  merchantId: string;
  hashKey: string;
  hashIv: string;
  isStaging: boolean;
}

export type ShippingType = 'UNIMART' | 'FAMI' | 'HILIFE';

// LogisticsSubType for C2C (不需額外申請 B2C)
const CVS_SUBTYPE: Record<ShippingType, string> = {
  UNIMART: 'UNIMARTC2C',
  FAMI: 'FAMIC2C',
  HILIFE: 'HILIFEC2C',
};

export function getLogisticsConfig(): LogisticsConfig {
  return {
    merchantId: process.env.ECPAY_LOGISTICS_MERCHANT_ID!,
    hashKey: process.env.ECPAY_LOGISTICS_HASH_KEY!,
    hashIv: process.env.ECPAY_LOGISTICS_HASH_IV!,
    isStaging: process.env.ECPAY_IS_STAGING !== 'false',
  };
}

function getLogisticsBaseUrl(isStaging: boolean): string {
  return isStaging
    ? 'https://logistics-stage.ecpay.com.tw'
    : 'https://logistics.ecpay.com.tw';
}

// ─── 門市地圖選取 form params ─────────────────────────────────
export function buildStoreMapParams(opts: {
  shippingType: ShippingType;
  serverReplyUrl: string;   // 後端 store-callback endpoint
  extraData: string;         // pendingCheckoutId，ECPay 原封回傳
}, config: LogisticsConfig): { url: string; params: Record<string, string> } {
  const params: Record<string, string> = {
    MerchantID: config.merchantId,
    LogisticsType: 'CVS',
    LogisticsSubType: CVS_SUBTYPE[opts.shippingType],
    IsCollection: 'Y',
    ServerReplyURL: opts.serverReplyUrl,
    ExtraData: opts.extraData,
  };
  params.CheckMacValue = generateCheckMacValue(params, config.hashKey, config.hashIv, 'md5');
  return {
    url: `${getLogisticsBaseUrl(config.isStaging)}/Express/map`,
    params,
  };
}

// ─── 建立物流訂單（Create）────────────────────────────────────
export interface CreateLogisticsOrderParams {
  merchantTradeNo: string;
  goodsAmount: number;
  goodsName: string;
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  receiverStoreId: string;
  shippingType: ShippingType;
  serverReplyUrl: string;  // 物流狀態 callback
}

export interface LogisticsOrderResult {
  allPayLogisticsId: string;
  bookingNote: string;
}

export async function createLogisticsOrder(
  p: CreateLogisticsOrderParams,
  config: LogisticsConfig,
): Promise<LogisticsOrderResult> {
  const params: Record<string, string> = {
    MerchantID: config.merchantId,
    MerchantTradeNo: p.merchantTradeNo,
    MerchantTradeDate: getMerchantTradeDate(),
    LogisticsType: 'CVS',
    LogisticsSubType: CVS_SUBTYPE[p.shippingType],
    GoodsAmount: String(Math.round(p.goodsAmount)),
    IsCollection: 'Y',
    CollectionAmount: String(Math.round(p.goodsAmount)),
    GoodsName: p.goodsName.slice(0, 50),
    SenderName: p.senderName,
    SenderPhone: p.senderPhone,
    ReceiverName: p.receiverName,
    ReceiverCellPhone: p.receiverPhone,
    ReceiverStoreID: p.receiverStoreId,
    ServerReplyURL: p.serverReplyUrl,
  };
  params.CheckMacValue = generateCheckMacValue(params, config.hashKey, config.hashIv, 'md5');

  const url = `${getLogisticsBaseUrl(config.isStaging)}/Express/Create`;
  const body = new URLSearchParams(params).toString();

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(30_000),
  });

  if (!resp.ok) throw new Error(`Logistics API HTTP ${resp.status}`);

  const text = await resp.text();
  // 回應格式：1|key1=value1&key2=value2 或 key1=value1&...
  const payload = text.includes('|') ? text.split('|').slice(1).join('|') : text;
  const result = Object.fromEntries(new URLSearchParams(payload));
  if (result.RtnCode !== '1' && result.RtnCode !== '300') {
    throw new Error(`Logistics API error: ${result.RtnMsg ?? text}`);
  }

  return {
    allPayLogisticsId: result.AllPayLogisticsID ?? '',
    bookingNote: result.BookingNote ?? '',
  };
}

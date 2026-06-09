import crypto from 'crypto';

// ─── 型別 ─────────────────────────────────────────────────────
export interface EcpayConfig {
  merchantId: string;
  hashKey: string;
  hashIv: string;
  isStaging: boolean;
}

export interface AioParams {
  [key: string]: string;
}

// ─── 設定（從環境變數讀） ──────────────────────────────────────
export function getPaymentConfig(): EcpayConfig {
  return {
    merchantId: process.env.ECPAY_MERCHANT_ID!,
    hashKey: process.env.ECPAY_HASH_KEY!,
    hashIv: process.env.ECPAY_HASH_IV!,
    isStaging: process.env.ECPAY_IS_STAGING !== 'false',
  };
}

export function getAioBaseUrl(isStaging: boolean): string {
  return isStaging
    ? 'https://payment-stage.ecpay.com.tw'
    : 'https://payment.ecpay.com.tw';
}

// ─── ECPay 專用 URL Encode（僅用於 CheckMacValue）──────────────
function ecpayUrlEncode(source: string): string {
  let encoded = encodeURIComponent(source)
    .replace(/%20/g, '+')
    .replace(/~/g, '%7e')
    .replace(/'/g, '%27');
  encoded = encoded.toLowerCase();
  const restorations: Record<string, string> = {
    '%2d': '-', '%5f': '_', '%2e': '.', '%21': '!',
    '%2a': '*', '%28': '(', '%29': ')',
  };
  for (const [enc, char] of Object.entries(restorations)) {
    encoded = encoded.split(enc).join(char);
  }
  return encoded;
}

// ─── CheckMacValue（SHA256 預設；MD5 給物流用）──────────────────
export function generateCheckMacValue(
  params: AioParams,
  hashKey: string,
  hashIv: string,
  method: 'sha256' | 'md5' = 'sha256',
): string {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([k]) => k !== 'CheckMacValue'),
  );
  const sorted = Object.keys(filtered).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );
  const paramStr = sorted.map(k => `${k}=${filtered[k]}`).join('&');
  const raw = `HashKey=${hashKey}&${paramStr}&HashIV=${hashIv}`;
  const encoded = ecpayUrlEncode(raw);
  return crypto.createHash(method).update(encoded, 'utf8').digest('hex').toUpperCase();
}

export function verifyCheckMacValue(
  params: AioParams,
  hashKey: string,
  hashIv: string,
  method: 'sha256' | 'md5' = 'sha256',
): boolean {
  const received = params.CheckMacValue ?? '';
  const calculated = generateCheckMacValue(params, hashKey, hashIv, method);
  const a = Buffer.from(received);
  const b = Buffer.from(calculated);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ─── 日期格式（台灣時間 Asia/Taipei，yyyy/MM/dd HH:mm:ss）────────
export function getMerchantTradeDate(): string {
  return new Date().toLocaleString('sv-SE', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).replace(/-/g, '/');
}

// ─── MerchantTradeNo 產生（≤20 英數字，唯一）─────────────────────
export function generateMerchantTradeNo(): string {
  const ts = Date.now().toString();                              // 13 digits
  const rand = Math.floor(Math.random() * 9000 + 1000).toString(); // 4 digits
  return `PP${ts}${rand}`;                                       // 19 chars
}

// ─── AIO Checkout Params 建構 ────────────────────────────────
interface BuildAioParams {
  merchantTradeNo: string;
  total: number;
  itemName: string;
  choosePayment: 'Credit' | 'CVS' | 'ALL';
  returnUrl: string;
  orderResultUrl: string;
  clientBackUrl?: string;
}

export function buildAioParams(p: BuildAioParams, config: EcpayConfig): AioParams {
  const params: AioParams = {
    MerchantID: config.merchantId,
    MerchantTradeNo: p.merchantTradeNo,
    MerchantTradeDate: getMerchantTradeDate(),
    PaymentType: 'aio',
    TotalAmount: String(Math.round(p.total)),
    TradeDesc: encodeURIComponent('卡拍拍訂單'),
    ItemName: p.itemName.slice(0, 400),
    ReturnURL: p.returnUrl,
    OrderResultURL: p.orderResultUrl,
    ChoosePayment: p.choosePayment,
    EncryptType: '1',
    ...(p.clientBackUrl ? { ClientBackURL: p.clientBackUrl } : {}),
    ...(p.choosePayment === 'CVS' ? { StoreExpireSeconds: '259200' } : {}),
  };
  params.CheckMacValue = generateCheckMacValue(params, config.hashKey, config.hashIv);
  return params;
}

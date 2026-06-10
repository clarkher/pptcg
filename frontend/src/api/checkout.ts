import { api } from './client';

export type PaymentMethod = 'credit' | 'cvs' | 'cvs_cod';
export type ShippingType = 'UNIMART' | 'FAMI' | 'HILIFE';

export interface CheckoutResponse {
  orderId: string;
  ecpayUrl: string;
  ecpayParams: Record<string, string>;
}

export interface SelectStoreResponse {
  pendingId: string;
  ecpayUrl: string;
  ecpayParams: Record<string, string>;
}

export interface PendingCheckoutInfo {
  id: string;
  storeId?: string | null;
  storeName?: string | null;
  storeAddress?: string | null;
  shippingType: string;
  receiverName: string;
  receiverPhone: string;
}

export const checkoutApi = {
  create: async (
    paymentMethod: 'credit' | 'cvs',
    receiverName: string,
    receiverPhone: string,
  ): Promise<CheckoutResponse> => {
    const { data } = await api.post('/checkout', { paymentMethod, receiverName, receiverPhone });
    return data;
  },
  selectStore: async (
    receiverName: string,
    receiverPhone: string,
    shippingType: ShippingType,
  ): Promise<SelectStoreResponse> => {
    const { data } = await api.post('/checkout/select-store', {
      receiverName, receiverPhone, shippingType,
    });
    return data;
  },
  confirmStore: async (pendingId: string): Promise<{ orderId: string; merchantTradeNo: string }> => {
    const { data } = await api.post('/checkout/confirm-store', { pendingId });
    return data;
  },
  getPending: async (id: string): Promise<PendingCheckoutInfo> => {
    const { data } = await api.get(`/checkout/pending/${id}`);
    return data;
  },
};

// 動態建立 form 並提交到綠界（redirect 模式）
export function submitEcpayForm(ecpayUrl: string, ecpayParams: Record<string, string>): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = ecpayUrl;
  for (const [k, v] of Object.entries(ecpayParams)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = k;
    input.value = v;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

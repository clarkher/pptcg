import { Router } from 'express';
import {
  paymentCallback, orderResult, storeCallback, logisticsCallback,
} from '../controllers/ecpay-callbacks';

const router = Router();
// 綠界直接呼叫，無需使用者登入
router.post('/payment-callback', paymentCallback);
router.get('/order-result', orderResult);
router.post('/order-result', orderResult);
router.post('/store-callback', storeCallback);
router.post('/logistics-callback', logisticsCallback);
export default router;

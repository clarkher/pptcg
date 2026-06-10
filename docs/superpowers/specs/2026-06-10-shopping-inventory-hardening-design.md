# 購物體驗 / 庫存正確性 強化設計

日期：2026-06-10
分支：`claude/distracted-saha-a39008`（worktree，**rebase 在 `dev` 之上**）→ 依部署規則先進 `dev`，確認後 `main`

> **基線說明**：`dev` 已有「卡拍拍式購物體驗」（量化扣庫存 `decrementStock`、購物車原子累加+夾上限、`PATCH /cart/:id`、`QtyStepper`、CardDetail/購物車數量選擇器、CVS 取號 `cvsPaymentCode` 冪等）。本次站在 dev 之上，**沿用** dev 的 `decrementStock`/`clampCartSet`/`QtyStepper`/購物車 UI，只補 dev 仍缺的硬邊界：把「付款才扣」改成「結帳即原子預留 + 逾時釋放」，並補齊 CVS 棄單釋放、COD 物流失敗回滾、退款回補數量、購物車偵測庫存被調少、結帳電話驗證。

## 問題根因

系統同時存在兩套互相打架的庫存概念：
- `Listing.quantity`（數字庫存，目錄/「剩 N」用它彙整）
- `Listing.status`（'active'/'sold' 售出旗標）

所有成交路徑都只翻 `status='sold'`，**從不扣 `quantity`**，導致：
- quantity=5 賣 1 張 → 整筆消失、剩 4 張憑空不見；退款又把 5 張全復活。
- 結帳不預留、不鎖 → 兩人同時買最後一張會超賣。
- 超商代碼取號後棄單 → 庫存永久鎖死（無釋放機制）。
- COD 物流建單失敗仍照常成交（靜默失敗）。
- 加入購物車不看「已在車內數量」、不擋超量。

## 核心決策

1. **庫存唯一真實來源 = `Listing.quantity`**（= 目前可買的剩餘量，已扣售出＋已預留）。
   `status` 由 quantity 推導：扣到 0 設 `sold`，回補 >0 設 `active`。
2. **超賣防護 = 結帳即預留（reserve-at-checkout）**，付款逾時/失敗自動釋放，付款成功只 finalize。
3. **可選購買數量**：CardDetail 變體列數量選擇器、購物車 +/− 調整（上限=剩餘）。

## 預留生命週期

| 事件 | 行為 |
|---|---|
| 按結帳（信用卡/CVS） | 單一 transaction：條件式扣量 → 建單（`reservationExpiresAt = now+30min`）→ 清空購物車。任一筆庫存不足 → 整單回滾、回 400「以下商品庫存不足或已售出：…」 |
| CVS 取號回呼 | 寫入 `cvsPaymentCode`/`cvsExpireDate`、把 `reservationExpiresAt` 延長為綠界真實 `ExpireDate`（約 3 天）、`status='pending_payment'`。**不重複扣量、不清車（已於結帳清）** |
| 付款成功回呼 | 只 finalize：`status='paid'`、`paymentStatus='paid'`、寫 `ecpayTradeNo`。**不重複扣量。** 冪等保護維持 |
| 付款失敗回呼 / 逾時 sweep | `releaseOrderReservation`：條件式把 `pending_payment` → `cancelled`，回補 `quantity`、status active |
| COD 選門市 | `selectStore` 只建 `PendingCheckout` 快照，**不預留** |
| COD 確認門市 | transaction：對「目前」庫存條件式扣量 → 建單 → 清車 → 刪 pending。接著呼叫物流 API；**失敗 → 釋放庫存＋訂單 cancelled＋回 502**（不再靜默成交） |
| 退款 | 回補 `quantity += 數量`、status active；對「0→正數」的卡觸發敲碗補貨通知 |

### 逾時釋放機制（無外部 cron）

- `releaseExpiredReservations()`：查 `status='pending_payment' AND paymentStatus≠'paid' AND reservationExpiresAt < now`，逐筆 `releaseOrderReservation`；另刪過期 `PendingCheckout`。
- 後端 `index.ts` 啟動掛 `setInterval`（每 3 分鐘）+ 結帳進入點呼叫一次（防呆）。
- **競態安全**：釋放用「條件式 `updateMany` 將 order 由 pending_payment 翻成 cancelled，count>0 才回補」——order 列鎖確保只釋放一次，不會重複回補。
- **不會發生「付了款但庫存已被釋放」**：預留窗口 = 綠界自己的付款期限，綠界不會在到期後回成功。故不需 charge-then-refund。
- 逾時釋放（棄單）**不**觸發敲碗通知（避免噪音）；只有退款這種真正回補才通知。

## 加入購物車 / 數量（沿用 dev，僅補強）

- `POST /api/cart`（dev 已有）：原子累加 + 夾到剩餘上限（夾擠而非報錯）。保留。
- `PATCH /api/cart/:listingId`（dev 已有，`clampCartSet` 1..剩餘）。保留。
- CardDetail 數量選擇器、購物車 `QtyStepper`（dev 已有）。保留。
- **本次補強**：
  - 購物車偵測 `item.quantity > 剩餘`（庫存被調少）或 `status≠active` → 即時警示並擋結帳（dev 原本只擋 `status≠active`，且 stepper 上限用 `max(購物車量, 剩餘)` 會放行超量）。stepper 上限改為剩餘。
  - Checkout 收件人電話加 `09xxxxxxxx` 格式驗證。

## Schema 變更

- `Order` 新增 `reservationExpiresAt DateTime?`。
- 一次性資料修正：既有 `status='sold'` 的 Listing → `quantity = 0`（避免新模型把舊售出復活）。先 dev 再 prod。
  （ECPay 尚未上正式金鑰，prod 幾乎無真實成交，風險低。）

## 影響檔案

後端：`prisma/schema.prisma`、新增 `src/lib/reservation.ts`(+test)、`src/controllers/cart.ts`、`src/routes/cart.ts`、`src/controllers/checkout.ts`、`src/controllers/ecpay-callbacks.ts`、`src/controllers/admin.ts`(退款＋修 stats pending 計數)、`src/index.ts`。
前端：`src/api/cart.ts`、`src/stores/cartStore.ts`、`src/pages/Cart.tsx`、`src/pages/CardDetail.tsx`、`src/pages/Checkout.tsx`、型別 `src/types/index.ts`。

## 測試

- `reservation.test.ts`：`parseEcpayExpireDate`（含 fallback）、`validateCartAdd`（累加超量/剛好/0）、`clampSetQty`。
- 既有 `inventory.test.ts` 不變。

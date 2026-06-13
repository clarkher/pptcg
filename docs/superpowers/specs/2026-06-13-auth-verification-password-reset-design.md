# 註冊登入系統完整化設計（信箱驗證 + 忘記密碼 + 確認密碼）

> 狀態：待使用者確認 spec，通過後寫實作計畫

## 目標

把現有的精簡版註冊/登入補成「完整」的帳號系統，包含三件事：

1. **確認密碼欄位** — 註冊時再次輸入密碼，前後端都驗證一致。
2. **信箱驗證信（軟卡）** — 註冊後寄驗證信；未驗證可登入瀏覽，但**上架賣卡**與**結帳**這兩個金流動作會被擋下，直到驗證完成。
3. **忘記密碼 / 重設密碼** — 輸入 email 收重設連結，設定新密碼。

寄信服務用 **Resend**。**Google 登入的用戶一律視為已驗證**，不受任何影響。

## 現況（研究結果）

- 後端 `backend/src/controllers/auth.ts`：`register` 收 email/username/password → bcrypt → **直接發 JWT**，無任何驗證；`login` bcrypt 比對；`googleLogin` 走 Google OAuth；`me` 回使用者。
- 前端 `frontend/src/pages/Register.tsx` 只有 3 欄、**無確認密碼**；`Login.tsx` 無「忘記密碼」入口；`stores/authStore.ts` 有 login/loginWithGoogle/register/logout/refreshUser。
- `User` schema 缺 `emailVerified` 與任何 token 欄位。
- **完全沒有寄信基礎設施**（無 nodemailer/SendGrid/Resend/SMTP）；現有對外通知只有 Telegram（fetch Telegram API）和 LINE push。
- 設定值存 `Setting`(key/value) 表；`FRONTEND_URL` / `BACKEND_URL` env 已有。
- 一般使用者的金流動作：`POST /listings`（上架，`authMiddleware`）與 `POST /checkout`（結帳，`authMiddleware`）。

## 資料模型（Prisma schema）

### `User` 新增欄位

```prisma
model User {
  // ...既有欄位不變
  emailVerified Boolean @default(false)  // 新增
}
```

- 密碼註冊：建立時 `false`，驗證信點擊後轉 `true`。
- Google 註冊/綁定：一律 `true`（`googleLogin` 建立與綁定分支都設）。
- 重設密碼成功：順便設 `true`（能收到重設信＝證明信箱所有權）。

### 新增 `AuthToken` 表（一張表處理兩種 token）

```prisma
model AuthToken {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      String    // "verify_email" | "reset_password"
  tokenHash String    @unique   // 只存原始 token 的 sha256
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId, type])
}
```

**Token 設計原則：**
- 信件連結帶**原始隨機 token**（`crypto.randomBytes(32).toString('hex')`），DB 只存其 `sha256`。即使 DB 外洩也拿不到有效連結。
- 驗證 token 存活 **24h**；重設 token 存活 **1h**。
- **單次使用**：用過設 `usedAt`。
- 重新發送同類 token 時，把該用戶該 type 底下未使用的舊 token 一併標記作廢（`usedAt = now`），避免多個有效連結並存。
- 驗證時：對傳入的原始 token 做 sha256 → 查 `tokenHash` → 檢查 `usedAt == null && expiresAt > now`。

## 寄信模組 `backend/src/lib/email.ts`

- 用 **fetch 直接呼叫 Resend API**（不裝 SDK，與既有呼叫 Telegram API 的風格一致）。
- 介面：`sendEmail({ to, subject, html }): Promise<boolean>`。
- 設定：`RESEND_API_KEY`、`RESEND_FROM`（如 `屁TCG <noreply@pipicards.com>`）。
- 兩個品牌化 HTML 樣板函式：
  - `verificationEmail(link)` — 「驗證你的信箱」。
  - `resetPasswordEmail(link)` — 「重設你的密碼」。
  - 沿用品牌色（青 `#00e5ff` / 深底 `#050508`）。
- **本地/缺金鑰 fallback**：未設 `RESEND_API_KEY` 時不真的寄信，改 `console.log` 印出連結並回傳成功 — 本機與 staging 不必真寄信即可測流程。

連結組法：`${FRONTEND_URL}/verify-email?token=<raw>`、`${FRONTEND_URL}/reset-password?token=<raw>`。

## 後端 API（`controllers/auth.ts` + `routes/auth.ts`）

| Method | Path | 行為 |
|---|---|---|
| POST | `/auth/register` | 收 email/username/password（確認密碼為純前端比對，後端不收）；建立 user(`emailVerified:false`)；產生 verify token；寄驗證信。**仍回傳 JWT + user**（軟卡可登入）。回應 user 帶 `emailVerified:false`。 |
| POST | `/auth/verify-email` | body `{ token }`：驗 token → `emailVerified:true`、標記 token 已用。回 200/400。 |
| POST | `/auth/resend-verification` | 需 `authMiddleware`；若該用戶已驗證回 200 no-op；否則作廢舊 token、產生新 token、重寄。**限流**。 |
| POST | `/auth/forgot-password` | body `{ email }`：**一律回 200**（防帳號列舉）；若 email 存在且 `password != null`（非純 Google 帳號）才產生 reset token + 寄信。**限流**。 |
| POST | `/auth/reset-password` | body `{ token, password }`：驗 token → bcrypt 更新密碼、`emailVerified:true`、標記 token 已用、作廢其他未用 reset token。 |
| GET | `/auth/me` | 回應多帶 `emailVerified`。 |

- `register` 的 username 仍維持 minLength 2、password minLength 6（與現況一致，本次不加密碼強度規則）。
- `googleLogin`：建立與「補綁 googleId」兩個分支都把 `emailVerified` 設 `true`。

### 限流

裝 `express-rate-limit`，對敏感路由按 IP 限制：
- `/auth/forgot-password`、`/auth/resend-verification`：例如 15 分鐘內最多 5 次。
- 超過回 429 + 友善訊息。

## 軟卡攔截 `middleware/requireVerified`

新增 middleware，接在 `authMiddleware` 之後：查 `user.emailVerified`，若 `false` 回 **403 + `{ error, code: 'EMAIL_NOT_VERIFIED' }`**。掛在：
- `POST /listings`（上架賣卡）
- `POST /checkout`（結帳）

> 範圍限定這兩條金流動作；綁定 LINE、敲碗 Wishlist 等不擋（YAGNI）。

前端攔截到 `code === 'EMAIL_NOT_VERIFIED'` → 顯示「請先驗證信箱」提示 + 重發按鈕。

## 前端（React）

### 既有頁面修改
- `Register.tsx`：加「確認密碼」欄 + 即時比對（不一致時擋送出並提示）；註冊成功後顯示「驗證信已寄到 xxx，請查收」狀態（仍導向首頁）。
- `Login.tsx`：表單下方加「忘記密碼？」連結。

### 新頁面（加進 `App.tsx` 公開路由區）
- `/verify-email`：讀 `?token` → 自動呼叫 `/auth/verify-email` → 顯示成功/失敗（失敗給「重新寄送」）。
- `/forgot-password`：輸入 email → 呼叫 `/auth/forgot-password` → 一律顯示「若該信箱存在，重設信已寄出」。
- `/reset-password`：讀 `?token` → 新密碼 + 確認密碼 → 呼叫 `/auth/reset-password` → 成功導向登入。

### 元件
- `VerifyEmailBanner`：登入且 `user.emailVerified === false` 時，於頂部顯示提示條 + 「重新寄送驗證信」按鈕（呼叫 `/auth/resend-verification`，含冷卻 UI）。

### authStore
- `user` 型別加 `emailVerified`。
- 新增 action：`forgotPassword(email)`、`resetPassword(token, password)`、`resendVerification()`。
- `register` 簽名不變（仍 `email, username, password`）。確認密碼只在 `Register.tsx` 頁面層比對，兩次不一致就擋送出，**不傳後端**（confirm 純粹是防打錯的 UX 守門，後端再比對沒有安全意義）。

## 測試（vitest）

後端單元測試（email 模組 mock 掉）：
- token 產生 → sha256 存入 → 用原始 token 驗證成功。
- 過期 token 驗證失敗。
- 已使用 token 再用失敗。
- `forgot-password`：不存在的 email 也回 200、且不產生 token；純 Google 帳號（password=null）不產生 reset token。
- `reset-password`：成功更新密碼、設 `emailVerified:true`、舊 reset token 作廢。
- `requireVerified`：未驗證打 `/listings`、`/checkout` 得 403 + `EMAIL_NOT_VERIFIED`；已驗證放行。
- `googleLogin` 建立的用戶 `emailVerified === true`。

## 設定（env）

需加到 `backend/.env.example` 及 Railway（staging + prod 兩個服務）：
- `RESEND_API_KEY` — 由使用者於 resend.com 申請後提供。
- `RESEND_FROM` — 如 `屁TCG <noreply@pipicards.com>`。
- `FRONTEND_URL` — 已有，用來組驗證/重設連結。

**域名驗證**：Resend 需在 `pipicards.com` 加幾筆 DNS（SPF/DKIM）。Cloudflare DNS 由我用 API 代加（需 Cloudflare API token 授權）。在金鑰與 DNS 就緒前，後端走 console.log fallback，流程可先在 staging 驗證。

## 部署

依專案規則：先 commit 到 `dev` 分支（staging + pptcg-dev.vercel.app 驗證），使用者確認後再 merge `main` 上正式機。Prisma schema 變更需對 staging（ep-rough-butterfly）與 prod（ep-autumn-dream）兩個 Neon DB 各跑一次 migration。

## 非目標（YAGNI）

- 密碼強度規則（大小寫/符號強制）。
- 兩步驟驗證（2FA）。
- 變更 email 流程、帳號刪除。
- 簡訊驗證。
- 擋上架/結帳以外的動作。

# 註冊登入完整化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在現有精簡版註冊/登入上補齊「確認密碼 + 信箱驗證信（軟卡）+ 忘記密碼/重設」，寄信用 Resend。

**Architecture:** 後端把 token 邏輯抽成純函式（可單元測試），DB 用一張 `AuthToken` 表（只存 sha256、單次使用、有過期）處理驗證信與重設信兩種 token；信件用 fetch 打 Resend，缺金鑰時 fallback 印 console。軟卡用 `requireVerified` middleware 只擋上架與結帳。前端加確認密碼欄、三個新頁、與未驗證提示 banner。

**Tech Stack:** Express + Prisma(Neon Postgres) + JWT + bcryptjs + Resend(fetch) + express-rate-limit；前端 React + Zustand + react-router-dom。

**測試慣例（重要）：** 本專案的 vitest 測試只測**純函式**（見 `backend/src/lib/*.test.ts`），不 mock prisma、無測試 DB。因此 TDD 集中在可純化的邏輯（token 雜湊/有效性、信件樣板、重設資格判斷）；controller / middleware / 前端以 dev server + curl/preview 做行為驗證。

**部署規則：** 全程 commit 到目前分支；schema 變更先對 **staging Neon**（ep-rough-butterfly）`prisma db push`，正式機（ep-autumn-dream）於 merge `main` 時再 push。

---

### Task 1: Prisma schema — `emailVerified` + `AuthToken`

**Files:**
- Modify: `backend/prisma/schema.prisma`（`model User` 區塊與檔尾新增 model）

- [ ] **Step 1: 在 `model User` 加 `emailVerified` 欄位**

在 `model User` 內 `lineUid` 之後、`createdAt` 之前加一行（縮排對齊既有欄位）：

```prisma
  emailVerified Boolean   @default(false)
```

- [ ] **Step 2: 在 schema 檔尾新增 `AuthToken` model**

```prisma
model AuthToken {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      String    // "verify_email" | "reset_password"
  tokenHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId, type])
}
```

- [ ] **Step 3: 在 `model User` 的關聯區加上反向關聯**

在 `model User` 內 `notifications Notification[]` 那一行下面加：

```prisma
  authTokens    AuthToken[]
```

- [ ] **Step 4: 產生 client 並 push 到 staging Neon**

Run（先取 staging DATABASE_URL，避免 worktree `.env` 是舊 URL）：
```bash
cd backend
STAGING_DB=$(railway variables -s pptcg-backend-staging --kv | grep '^DATABASE_URL=' | cut -d= -f2-)
npx prisma generate
DATABASE_URL="$STAGING_DB" npx prisma db push
```
Expected: `prisma generate` 成功；`db push` 顯示 `Your database is now in sync with your Prisma schema.`（新增欄位/表，無資料破壞）。

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(auth): add emailVerified + AuthToken model"
```

---

### Task 2: 純 auth helpers（TDD）

**Files:**
- Create: `backend/src/lib/auth-helpers.ts`
- Test: `backend/src/lib/auth-helpers.test.ts`

- [ ] **Step 1: 寫失敗測試**

`backend/src/lib/auth-helpers.test.ts`：
```ts
import { describe, it, expect } from 'vitest';
import {
  hashToken, createTokenPair, isTokenUsable, buildAuthLink, canIssueReset,
  VERIFY_TTL_MS, RESET_TTL_MS,
} from './auth-helpers';

describe('hashToken', () => {
  it('是 deterministic 的 64 字元 hex sha256', () => {
    const a = hashToken('abc');
    expect(a).toBe(hashToken('abc'));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(hashToken('abd'));
  });
});

describe('createTokenPair', () => {
  it('回傳 raw(64 hex)、其 sha256、now+ttl 的 expiresAt', () => {
    const now = new Date('2026-06-13T00:00:00Z');
    const { raw, tokenHash, expiresAt } = createTokenPair(VERIFY_TTL_MS, now);
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).toBe(hashToken(raw));
    expect(expiresAt.getTime()).toBe(now.getTime() + VERIFY_TTL_MS);
  });
  it('每次 raw 不同', () => {
    expect(createTokenPair(RESET_TTL_MS).raw).not.toBe(createTokenPair(RESET_TTL_MS).raw);
  });
});

describe('isTokenUsable', () => {
  const now = new Date('2026-06-13T00:00:00Z');
  it('未使用且未過期 → true', () => {
    expect(isTokenUsable({ usedAt: null, expiresAt: new Date(now.getTime() + 1000) }, now)).toBe(true);
  });
  it('已使用 → false', () => {
    expect(isTokenUsable({ usedAt: now, expiresAt: new Date(now.getTime() + 1000) }, now)).toBe(false);
  });
  it('已過期 → false', () => {
    expect(isTokenUsable({ usedAt: null, expiresAt: new Date(now.getTime() - 1000) }, now)).toBe(false);
  });
});

describe('buildAuthLink', () => {
  it('組出連結並去掉結尾斜線', () => {
    expect(buildAuthLink('https://x.com/', '/verify-email', 'tok')).toBe('https://x.com/verify-email?token=tok');
    expect(buildAuthLink('https://x.com', '/reset-password', 'tok')).toBe('https://x.com/reset-password?token=tok');
  });
});

describe('canIssueReset', () => {
  it('有密碼 → true', () => expect(canIssueReset({ password: 'h' })).toBe(true));
  it('純 Google 帳號(password null) → false', () => expect(canIssueReset({ password: null })).toBe(false));
  it('查無使用者 → false', () => expect(canIssueReset(null)).toBe(false));
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd backend && npx vitest run src/lib/auth-helpers.test.ts`
Expected: FAIL（`Cannot find module './auth-helpers'`）。

- [ ] **Step 3: 實作**

`backend/src/lib/auth-helpers.ts`：
```ts
import crypto from 'crypto';

export const VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
export const RESET_TTL_MS = 60 * 60 * 1000;        // 1h

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function createTokenPair(
  ttlMs: number,
  now: Date = new Date(),
): { raw: string; tokenHash: string; expiresAt: Date } {
  const raw = crypto.randomBytes(32).toString('hex');
  return { raw, tokenHash: hashToken(raw), expiresAt: new Date(now.getTime() + ttlMs) };
}

export function isTokenUsable(
  token: { usedAt: Date | null; expiresAt: Date },
  now: Date = new Date(),
): boolean {
  return token.usedAt === null && token.expiresAt.getTime() > now.getTime();
}

export function buildAuthLink(frontendUrl: string, path: string, rawToken: string): string {
  return `${frontendUrl.replace(/\/$/, '')}${path}?token=${rawToken}`;
}

// 純 Google 帳號（password 為 null）不發重設信
export function canIssueReset(user: { password: string | null } | null): boolean {
  return !!user && !!user.password;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd backend && npx vitest run src/lib/auth-helpers.test.ts`
Expected: PASS（全部 case 綠）。

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/auth-helpers.ts backend/src/lib/auth-helpers.test.ts
git commit -m "feat(auth): pure token/reset helpers with tests"
```

---

### Task 3: 寄信模組（TDD 樣板）

**Files:**
- Create: `backend/src/lib/email.ts`
- Test: `backend/src/lib/email.test.ts`

- [ ] **Step 1: 寫失敗測試**

`backend/src/lib/email.test.ts`：
```ts
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
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `cd backend && npx vitest run src/lib/email.test.ts`
Expected: FAIL（找不到模組）。

- [ ] **Step 3: 實作**

`backend/src/lib/email.ts`：
```ts
// 品牌化交易信。寄送走 Resend HTTP API（與專案呼叫 Telegram API 同風格，不裝 SDK）。

function layout(title: string, bodyHtml: string, link: string, cta: string): string {
  return `<div style="background:#050508;padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <div style="max-width:440px;margin:0 auto;background:#0d0d14;border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:32px 28px;color:#F1F5F9;">
      <h1 style="font-size:20px;font-weight:800;color:#00e5ff;margin:0 0 16px;">屁TCG</h1>
      <h2 style="font-size:17px;font-weight:700;margin:0 0 12px;">${title}</h2>
      <div style="font-size:14px;color:#94a3b8;line-height:1.6;">${bodyHtml}</div>
      <a href="${link}" style="display:inline-block;margin:22px 0;padding:13px 26px;border-radius:12px;background:linear-gradient(135deg,#00e5ff,#00b8cc);color:#000;font-weight:800;font-size:14px;text-decoration:none;">${cta}</a>
      <p style="font-size:12px;color:#475569;margin:0;word-break:break-all;">若按鈕無法點擊，請複製此連結：<br>${link}</p>
    </div>
  </div>`;
}

export function verificationEmailHtml(link: string): string {
  return layout(
    '驗證你的信箱',
    '歡迎加入屁TCG！請點下方按鈕完成信箱驗證。連結 24 小時內有效，若你沒有註冊請忽略本信。',
    link,
    '驗證信箱',
  );
}

export function resetPasswordEmailHtml(link: string): string {
  return layout(
    '重設你的密碼',
    '我們收到重設密碼的要求。點下方按鈕設定新密碼，連結 1 小時內有效。若非你本人操作請忽略本信，你的密碼不會改變。',
    link,
    '重設密碼',
  );
}

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || '屁TCG <onboarding@resend.dev>';
  // 缺金鑰 fallback：本機/staging 不真寄信，改印連結到 console
  if (!apiKey) {
    console.log(`[email:fallback] to=${opts.to} subject="${opts.subject}"\n${opts.html}`);
    return true;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html }),
    });
    if (!res.ok) console.error('[email] Resend 失敗', res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error('[email] 寄送例外', e);
    return false;
  }
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `cd backend && npx vitest run src/lib/email.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/email.ts backend/src/lib/email.test.ts
git commit -m "feat(auth): email module (Resend + console fallback)"
```

---

### Task 4: `requireVerified` middleware + 套用到上架/結帳

**Files:**
- Create: `backend/src/middleware/requireVerified.ts`
- Modify: `backend/src/routes/listings.ts`
- Modify: `backend/src/routes/checkout.ts`

- [ ] **Step 1: 建立 middleware**

`backend/src/middleware/requireVerified.ts`：
```ts
import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from './auth';

// 必須接在 authMiddleware 之後（依賴 req.userId）
export async function requireVerified(req: AuthRequest, res: Response, next: NextFunction) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { emailVerified: true },
  });
  if (!user) {
    res.status(401).json({ error: '使用者不存在' });
    return;
  }
  if (!user.emailVerified) {
    res.status(403).json({ error: '請先完成信箱驗證才能進行此操作', code: 'EMAIL_NOT_VERIFIED' });
    return;
  }
  next();
}
```

- [ ] **Step 2: 套到上架路由**

`backend/src/routes/listings.ts`：把 import 與 POST 行改成：
```ts
import { Router } from 'express';
import { getListings, createListing, getMyListings, deleteListing } from '../controllers/listings';
import { authMiddleware } from '../middleware/auth';
import { requireVerified } from '../middleware/requireVerified';

const router = Router();
router.get('/', getListings);
router.post('/', authMiddleware, requireVerified, createListing);
router.get('/mine', authMiddleware, getMyListings);
router.delete('/:id', authMiddleware, deleteListing);
export default router;
```

- [ ] **Step 3: 套到結帳路由**

`backend/src/routes/checkout.ts`：在 `router.use(authMiddleware)` 之後、`createCheckout` 之前加 `requireVerified`：
```ts
import { Router } from 'express';
import { createCheckout, selectStore, confirmStore, getPending } from '../controllers/checkout';
import { authMiddleware } from '../middleware/auth';
import { requireVerified } from '../middleware/requireVerified';

const router = Router();
router.use(authMiddleware);
router.post('/', requireVerified, createCheckout);
router.post('/select-store', selectStore);
router.post('/confirm-store', confirmStore);
router.get('/pending/:id', getPending);
export default router;
```

- [ ] **Step 4: 型別檢查**

Run: `cd backend && npx tsc --noEmit`
Expected: 無錯誤。

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/requireVerified.ts backend/src/routes/listings.ts backend/src/routes/checkout.ts
git commit -m "feat(auth): requireVerified soft-gate on listing & checkout"
```

---

### Task 5: 後端 controller — register / verify-email / resend + me + google + routes

**Files:**
- Modify: `backend/src/controllers/auth.ts`
- Modify: `backend/src/routes/auth.ts`
- Modify: `backend/src/app.ts`（trust proxy）
- Modify: `backend/package.json`（express-rate-limit）

- [ ] **Step 1: 安裝 rate limit 套件**

Run: `cd backend && npm install express-rate-limit`
Expected: 加入 dependencies（v7 內建型別，無需 @types）。

- [ ] **Step 2: 改寫 `controllers/auth.ts` 的 import 與 register**

頂部 import 區加入：
```ts
import { prisma } from '../lib/prisma';
import {
  createTokenPair, hashToken, isTokenUsable, buildAuthLink, canIssueReset,
  VERIFY_TTL_MS, RESET_TTL_MS,
} from '../lib/auth-helpers';
import { sendEmail, verificationEmailHtml, resetPasswordEmailHtml } from '../lib/email';
```
（保留現有 `bcrypt`, `jwt`, `OAuth2Client`, `AuthRequest` 等 import；`prisma` 若已 import 則不重複。）

在檔案內新增私有 helper（放在 `register` 之前）：
```ts
const FRONTEND = () => process.env.FRONTEND_URL || 'http://localhost:5173';

async function issueAndSendVerification(userId: string, email: string) {
  await prisma.authToken.updateMany({
    where: { userId, type: 'verify_email', usedAt: null },
    data: { usedAt: new Date() },
  });
  const { raw, tokenHash, expiresAt } = createTokenPair(VERIFY_TTL_MS);
  await prisma.authToken.create({ data: { userId, type: 'verify_email', tokenHash, expiresAt } });
  const link = buildAuthLink(FRONTEND(), '/verify-email', raw);
  await sendEmail({ to: email, subject: '驗證你的屁TCG信箱', html: verificationEmailHtml(link) });
}
```

把 `register` 改成（建立時帶 `emailVerified` 到 select、建立後寄信）：
```ts
export async function register(req: Request, res: Response) {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    res.status(400).json({ error: '請填寫所有欄位' });
    return;
  }
  const exists = await prisma.user.findFirst({ where: { OR: [{ email }, { username }] } });
  if (exists) {
    res.status(409).json({ error: 'Email 或帳號已存在' });
    return;
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, username, password: hashed },
    select: { id: true, email: true, username: true, isAdmin: true, emailVerified: true },
  });
  await issueAndSendVerification(user.id, user.email);
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  res.json({ user, token });
}
```

- [ ] **Step 3: login 回應補 emailVerified**

把 `login` 的回應 user 物件改成包含 `emailVerified`：
```ts
  res.json({
    user: { id: user.id, email: user.email, username: user.username, isAdmin: user.isAdmin, emailVerified: user.emailVerified },
    token,
  });
```
（`user` 來自 `findUnique` 完整 record，已含 `emailVerified`，無需改 select。）

- [ ] **Step 4: googleLogin 設 emailVerified + 回應補欄位**

在 `googleLogin` 內：
- 建立分支 `prisma.user.create({ data: { ... } })` 的 data 加 `emailVerified: true`。
- 補綁分支 `prisma.user.update({ ... data: { googleId, avatar... } })` 的 data 加 `emailVerified: true`。
- 回應 user 物件加 `emailVerified: user.emailVerified`：
```ts
  res.json({
    user: { id: user.id, email: user.email, username: user.username, isAdmin: user.isAdmin, emailVerified: user.emailVerified },
    token,
  });
```

- [ ] **Step 5: me 補 emailVerified**

把 `me` 的 select 加 `emailVerified: true`，回應帶上：
```ts
export async function me(req: AuthRequest, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, username: true, avatar: true, isAdmin: true, lineUid: true, emailVerified: true },
  });
  if (!user) {
    res.status(404).json({ error: '使用者不存在' });
    return;
  }
  const { lineUid, ...rest } = user;
  res.json({ ...rest, lineBound: !!lineUid });
}
```

- [ ] **Step 6: 新增 verifyEmail / resendVerification**

在 `auth.ts` 末尾加：
```ts
export async function verifyEmail(req: Request, res: Response) {
  const { token } = req.body;
  if (!token) {
    res.status(400).json({ error: '缺少 token' });
    return;
  }
  const record = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.type !== 'verify_email' || !isTokenUsable(record)) {
    res.status(400).json({ error: '驗證連結無效或已過期' });
    return;
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerified: true } }),
    prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
  res.json({ ok: true });
}

export async function resendVerification(req: AuthRequest, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, emailVerified: true },
  });
  if (!user) {
    res.status(404).json({ error: '使用者不存在' });
    return;
  }
  if (user.emailVerified) {
    res.json({ ok: true, alreadyVerified: true });
    return;
  }
  await issueAndSendVerification(user.id, user.email);
  res.json({ ok: true });
}
```

- [ ] **Step 7: 改 `routes/auth.ts` 加新路由 + rate limiter**

`backend/src/routes/auth.ts`：
```ts
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  register, login, googleLogin, me,
  verifyEmail, resendVerification,
} from '../controllers/auth';
import { authMiddleware } from '../middleware/auth';

const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '嘗試次數過多，請 15 分鐘後再試' },
});

const router = Router();
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', authMiddleware, sensitiveLimiter, resendVerification);
router.get('/me', authMiddleware, me);
export default router;
```
（forgot/reset 路由在 Task 6 補上。）

- [ ] **Step 8: app.ts 設 trust proxy（Railway 在反向代理後，rate-limit 才能正確取 client IP）**

`backend/src/app.ts`：在 `const app = express();` 之後加一行：
```ts
app.set('trust proxy', 1);
```

- [ ] **Step 9: 型別檢查 + 啟動 dev server 驗證註冊流程**

Run: `cd backend && npx tsc --noEmit`
Expected: 無錯誤。

啟動 dev（用 staging DB），用 console.log fallback 驗證：
```bash
cd backend
STAGING_DB=$(railway variables -s pptcg-backend-staging --kv | grep '^DATABASE_URL=' | cut -d= -f2-)
DATABASE_URL="$STAGING_DB" JWT_SECRET=devsecret npm run dev
```
另開終端：
```bash
curl -s -X POST localhost:3001/api/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"vtest+'$RANDOM'@example.com","username":"vtest'$RANDOM'","password":"pass123"}'
```
Expected: 回 `{ user: { ..., emailVerified:false }, token }`；dev server console 印出 `[email:fallback] ... /verify-email?token=<raw>`。複製該 token：
```bash
curl -s -X POST localhost:3001/api/auth/verify-email -H 'Content-Type: application/json' -d '{"token":"<raw>"}'
```
Expected: `{ "ok": true }`。再打一次同 token → `{ "error": "驗證連結無效或已過期" }`（單次使用）。

- [ ] **Step 10: Commit**

```bash
git add backend/src/controllers/auth.ts backend/src/routes/auth.ts backend/src/app.ts backend/package.json backend/package-lock.json
git commit -m "feat(auth): email verification (register/verify/resend) + me/google emailVerified"
```

---

### Task 6: 後端 controller — forgot-password / reset-password

**Files:**
- Modify: `backend/src/controllers/auth.ts`
- Modify: `backend/src/routes/auth.ts`

- [ ] **Step 1: 新增 forgotPassword / resetPassword**

在 `auth.ts` 末尾加：
```ts
export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body;
  if (email) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, password: true },
    });
    if (canIssueReset(user) && user) {
      await prisma.authToken.updateMany({
        where: { userId: user.id, type: 'reset_password', usedAt: null },
        data: { usedAt: new Date() },
      });
      const { raw, tokenHash, expiresAt } = createTokenPair(RESET_TTL_MS);
      await prisma.authToken.create({ data: { userId: user.id, type: 'reset_password', tokenHash, expiresAt } });
      const link = buildAuthLink(FRONTEND(), '/reset-password', raw);
      await sendEmail({ to: user.email, subject: '重設你的屁TCG密碼', html: resetPasswordEmailHtml(link) });
    }
  }
  // 一律回 200，避免帳號列舉
  res.json({ ok: true });
}

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = req.body;
  if (!token || !password || String(password).length < 6) {
    res.status(400).json({ error: '密碼至少需 6 個字元' });
    return;
  }
  const record = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.type !== 'reset_password' || !isTokenUsable(record)) {
    res.status(400).json({ error: '重設連結無效或已過期' });
    return;
  }
  const hashed = await bcrypt.hash(password, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { password: hashed, emailVerified: true } }),
    prisma.authToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.authToken.updateMany({
      where: { userId: record.userId, type: 'reset_password', usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);
  res.json({ ok: true });
}
```

- [ ] **Step 2: 路由補上 forgot/reset**

`backend/src/routes/auth.ts`：import 加 `forgotPassword, resetPassword`，並加：
```ts
router.post('/forgot-password', sensitiveLimiter, forgotPassword);
router.post('/reset-password', resetPassword);
```
（放在 `/verify-email` 與 `/me` 之間即可。）

- [ ] **Step 3: 型別檢查 + curl 驗證重設流程**

Run: `cd backend && npx tsc --noEmit`（無錯誤）

dev server（同 Task 5 啟動方式）下：
```bash
# 用一個已存在、有密碼的帳號 email
curl -s -X POST localhost:3001/api/auth/forgot-password -H 'Content-Type: application/json' -d '{"email":"<existing>"}'
# → {"ok":true}；console fallback 印出 /reset-password?token=<raw>
curl -s -X POST localhost:3001/api/auth/reset-password -H 'Content-Type: application/json' -d '{"token":"<raw>","password":"newpass123"}'
# → {"ok":true}
# 用新密碼登入
curl -s -X POST localhost:3001/api/auth/login -H 'Content-Type: application/json' -d '{"email":"<existing>","password":"newpass123"}'
# → 回 user+token，且 user.emailVerified=true
# 不存在的 email 也回 ok（防列舉）
curl -s -X POST localhost:3001/api/auth/forgot-password -H 'Content-Type: application/json' -d '{"email":"nobody@nowhere.zzz"}'
# → {"ok":true}（console 不應印出任何 reset 連結）
```
Expected: 如上註解。

- [ ] **Step 4: 驗證軟卡（未驗證帳號被擋）**

用 Task 5 註冊但**未驗證**的帳號 token 打結帳：
```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3001/api/checkout \
  -H 'Authorization: Bearer <unverified-jwt>' -H 'Content-Type: application/json' -d '{}'
```
Expected: `403`，body 含 `"code":"EMAIL_NOT_VERIFIED"`。

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/auth.ts backend/src/routes/auth.ts
git commit -m "feat(auth): forgot-password / reset-password (anti-enumeration)"
```

---

### Task 7: 前端 — User 型別 + authStore actions

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/stores/authStore.ts`

- [ ] **Step 1: User 型別加 emailVerified**

`frontend/src/types/index.ts` 的 `interface User` 加一行：
```ts
  emailVerified?: boolean;
```

- [ ] **Step 2: authStore 加 actions**

`frontend/src/stores/authStore.ts`：在 `AuthState` interface 加：
```ts
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
  resendVerification: () => Promise<void>;
```
在 store 實作（`refreshUser` 之後）加：
```ts
      forgotPassword: async (email) => {
        await api.post('/auth/forgot-password', { email });
      },
      resetPassword: async (token, password) => {
        await api.post('/auth/reset-password', { token, password });
      },
      resendVerification: async () => {
        await api.post('/auth/resend-verification');
      },
```

- [ ] **Step 3: 型別檢查**

Run: `cd frontend && npx tsc --noEmit`
Expected: 無錯誤。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/stores/authStore.ts
git commit -m "feat(auth): authStore forgot/reset/resend + emailVerified type"
```

---

### Task 8: 前端 — 註冊加確認密碼 + 登入加忘記密碼連結

**Files:**
- Modify: `frontend/src/pages/Register.tsx`
- Modify: `frontend/src/pages/Login.tsx`

- [ ] **Step 1: Register 加 confirmPassword state**

`frontend/src/pages/Register.tsx`：在 `const [password, setPassword] = useState('');` 下加：
```tsx
  const [confirmPassword, setConfirmPassword] = useState('');
```

- [ ] **Step 2: handleSubmit 比對兩次密碼**

把 `handleSubmit` 內 `setLoading(true);` 之前加比對：
```tsx
    setError('');
    if (password !== confirmPassword) {
      setError('兩次輸入的密碼不一致');
      return;
    }
    setLoading(true);
```
（移除原本重複的 `setError('')`，保留這一份在最前。）

- [ ] **Step 3: fields 陣列加確認密碼欄**

把 `fields` 陣列末尾（密碼那筆之後）加一筆：
```tsx
    { label: '確認密碼', type: 'password', value: confirmPassword, set: setConfirmPassword, ph: '再次輸入密碼', min: 6 },
```

- [ ] **Step 4: Login 加「忘記密碼？」連結**

`frontend/src/pages/Login.tsx`：在密碼欄位 `</div>`（password 區塊結束）之後、submit 按鈕之前加：
```tsx
            <div style={{ textAlign: 'right', marginTop: -6 }}>
              <Link to="/forgot-password" style={{ fontSize: 12, color: '#64748B', textDecoration: 'none', fontWeight: 600 }}>
                忘記密碼？
              </Link>
            </div>
```
（`Link` 已從 `react-router-dom` import。）

- [ ] **Step 5: 型別檢查**

Run: `cd frontend && npx tsc --noEmit`
Expected: 無錯誤。

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Register.tsx frontend/src/pages/Login.tsx
git commit -m "feat(auth): confirm-password field + forgot-password link"
```

---

### Task 9: 前端 — 三個新頁 + 路由

**Files:**
- Create: `frontend/src/pages/VerifyEmail.tsx`
- Create: `frontend/src/pages/ForgotPassword.tsx`
- Create: `frontend/src/pages/ResetPassword.tsx`
- Modify: `frontend/src/App.tsx`

共用樣式：沿用 Login/Register 的深色卡片風（簡化版），以下元件自帶。

- [ ] **Step 1: VerifyEmail 頁**

`frontend/src/pages/VerifyEmail.tsx`：
```tsx
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';

const wrap: React.CSSProperties = {
  minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '24px 20px', background: '#050508',
};
const card: React.CSSProperties = {
  width: '100%', maxWidth: 380, textAlign: 'center',
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 24, padding: '36px 28px', color: '#F1F5F9',
};

export function VerifyEmail() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'ok' | 'fail'>('loading');

  useEffect(() => {
    const token = params.get('token');
    if (!token) { setStatus('fail'); return; }
    api.post('/auth/verify-email', { token })
      .then(() => setStatus('ok'))
      .catch(() => setStatus('fail'));
  }, [params]);

  return (
    <div style={wrap}>
      <div style={card}>
        {status === 'loading' && <p style={{ color: '#94a3b8' }}>驗證中…</p>}
        {status === 'ok' && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#00e5ff', marginBottom: 10 }}>信箱驗證成功 🎉</h2>
            <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>你的帳號已完成驗證，現在可以上架與結帳了。</p>
            <Link to="/" style={{ color: '#00e5ff', fontWeight: 700, textDecoration: 'none' }}>回首頁 →</Link>
          </>
        )}
        {status === 'fail' && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#F87171', marginBottom: 10 }}>連結無效或已過期</h2>
            <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>請登入後於頂部提示重新寄送驗證信。</p>
            <Link to="/login" style={{ color: '#00e5ff', fontWeight: 700, textDecoration: 'none' }}>前往登入 →</Link>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ForgotPassword 頁**

`frontend/src/pages/ForgotPassword.tsx`：
```tsx
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const wrap: React.CSSProperties = {
  minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '24px 20px', background: '#050508',
};
const card: React.CSSProperties = {
  width: '100%', maxWidth: 380,
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 24, padding: '32px 26px', color: '#F1F5F9',
};
const input: React.CSSProperties = {
  width: '100%', padding: '13px 16px', borderRadius: 14, fontSize: 14, color: '#F1F5F9',
  outline: 'none', fontFamily: 'inherit', background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.08)', boxSizing: 'border-box',
};
const btn: React.CSSProperties = {
  width: '100%', padding: '15px', borderRadius: 16, border: 'none', fontWeight: 900, fontSize: 15,
  color: '#000', cursor: 'pointer', background: 'linear-gradient(135deg, #00e5ff, #00b8cc)', marginTop: 16,
};

export function ForgotPassword() {
  const { forgotPassword } = useAuthStore();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try { await forgotPassword(email); } finally { setLoading(false); setSent(true); }
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 8 }}>忘記密碼</h2>
        {sent ? (
          <>
            <p style={{ fontSize: 14, color: '#94a3b8', margin: '12px 0 24px' }}>
              若該信箱有註冊帳號，重設連結已寄出，請查收信箱（含垃圾信匣）。
            </p>
            <Link to="/login" style={{ color: '#00e5ff', fontWeight: 700, textDecoration: 'none' }}>回登入 →</Link>
          </>
        ) : (
          <form onSubmit={submit}>
            <p style={{ fontSize: 13, color: '#64748B', margin: '4px 0 18px' }}>輸入註冊用的 Email，我們會寄重設連結給你。</p>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com" required style={input} />
            <button type="submit" disabled={loading} style={{ ...btn, opacity: loading ? 0.7 : 1 }}>
              {loading ? '寄送中…' : '寄送重設連結'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: ResetPassword 頁**

`frontend/src/pages/ResetPassword.tsx`：
```tsx
import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const wrap: React.CSSProperties = {
  minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '24px 20px', background: '#050508',
};
const card: React.CSSProperties = {
  width: '100%', maxWidth: 380,
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 24, padding: '32px 26px', color: '#F1F5F9',
};
const input: React.CSSProperties = {
  width: '100%', padding: '13px 16px', borderRadius: 14, fontSize: 14, color: '#F1F5F9',
  outline: 'none', fontFamily: 'inherit', background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.08)', boxSizing: 'border-box', marginBottom: 12,
};
const btn: React.CSSProperties = {
  width: '100%', padding: '15px', borderRadius: 16, border: 'none', fontWeight: 900, fontSize: 15,
  color: '#000', cursor: 'pointer', background: 'linear-gradient(135deg, #00e5ff, #00b8cc)', marginTop: 4,
};
const errBox: React.CSSProperties = {
  borderRadius: 12, padding: '10px 14px', textAlign: 'center', fontSize: 13, fontWeight: 600,
  color: '#F87171', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 12,
};

export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { resetPassword } = useAuthStore();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('兩次輸入的密碼不一致'); return; }
    if (password.length < 6) { setError('密碼至少需 6 個字元'); return; }
    setLoading(true);
    try {
      await resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || '重設失敗，連結可能已過期');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 16 }}>設定新密碼</h2>
        {done ? (
          <p style={{ fontSize: 14, color: '#00e5ff' }}>密碼已更新，正在帶你前往登入…</p>
        ) : !token ? (
          <>
            <p style={errBox as React.CSSProperties}>連結無效（缺少 token）</p>
            <Link to="/forgot-password" style={{ color: '#00e5ff', fontWeight: 700, textDecoration: 'none' }}>重新申請 →</Link>
          </>
        ) : (
          <form onSubmit={submit}>
            {error && <div style={errBox}>{error}</div>}
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="新密碼（至少 6 字元）" required minLength={6} style={input} />
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="再次輸入新密碼" required minLength={6} style={input} />
            <button type="submit" disabled={loading} style={{ ...btn, opacity: loading ? 0.7 : 1 }}>
              {loading ? '更新中…' : '更新密碼'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: App.tsx 加路由**

`frontend/src/App.tsx`：import 區加：
```tsx
import { VerifyEmail } from './pages/VerifyEmail';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';
```
在 `<Route path="/register" ... />` 之後加（同屬「Auth — no shell」區）：
```tsx
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
```

- [ ] **Step 5: 型別檢查**

Run: `cd frontend && npx tsc --noEmit`
Expected: 無錯誤。

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/VerifyEmail.tsx frontend/src/pages/ForgotPassword.tsx frontend/src/pages/ResetPassword.tsx frontend/src/App.tsx
git commit -m "feat(auth): verify-email / forgot-password / reset-password pages"
```

---

### Task 10: 前端 — 未驗證提示 banner + 掛載 + 金流動作攔截提示

**Files:**
- Create: `frontend/src/components/VerifyEmailBanner.tsx`
- Modify: `frontend/src/components/AppShell.tsx`

- [ ] **Step 1: 建立 banner 元件**

`frontend/src/components/VerifyEmailBanner.tsx`：
```tsx
import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';

export function VerifyEmailBanner() {
  const { user, resendVerification } = useAuthStore();
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  // 已登入且尚未驗證才顯示（Google 用戶 emailVerified=true 不顯示）
  if (!user || user.emailVerified) return null;

  const resend = async () => {
    if (cooldown) return;
    setCooldown(true);
    try { await resendVerification(); setSent(true); } catch { /* ignore */ }
    setTimeout(() => setCooldown(false), 60_000); // 60s 冷卻
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap',
      padding: '10px 16px', fontSize: 13, fontWeight: 600,
      color: '#FCD34D', background: 'rgba(251,191,36,0.08)',
      borderBottom: '1px solid rgba(251,191,36,0.2)',
    }}>
      <span>📧 你的信箱尚未驗證，上架與結帳前請先完成驗證。</span>
      <button onClick={resend} disabled={cooldown} style={{
        border: '1px solid rgba(251,191,36,0.4)', background: 'transparent',
        color: cooldown ? '#94a3b8' : '#FCD34D', borderRadius: 10, padding: '5px 12px',
        fontSize: 12, fontWeight: 700, cursor: cooldown ? 'default' : 'pointer',
      }}>
        {sent ? '已重新寄出' : cooldown ? '請稍候…' : '重新寄送驗證信'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 掛到 AppShell 的 main 內容頂部**

`frontend/src/components/AppShell.tsx`：頂部 import 加：
```tsx
import { VerifyEmailBanner } from './VerifyEmailBanner';
```
把 `<main>` 內容改成在容器頂部放 banner（約檔案第 263–268 行）：
```tsx
      <main style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <NotificationBell />
        <VerifyEmailBanner />
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {children}
        </div>
      </main>
```

- [ ] **Step 3: 結帳頁攔截 EMAIL_NOT_VERIFIED 友善提示**

`frontend/src/pages/Checkout.tsx`：把現有的 `catch (err: any)` 區塊（約第 58–61 行）改成先判斷未驗證 code：
```tsx
    } catch (err: any) {
      if (err.response?.status === 403 && err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        setError('請先完成信箱驗證才能結帳——可在頁面頂部「重新寄送驗證信」。');
      } else {
        setError(err.response?.data?.error || '結帳失敗，請稍後再試');
      }
      setSubmitting(false);
    }
```
（只動這個 catch；其餘結帳邏輯不變。`code` 只會在被 `requireVerified` 擋下的 `checkoutApi.create` 路徑出現。）

- [ ] **Step 4: 型別檢查**

Run: `cd frontend && npx tsc --noEmit`
Expected: 無錯誤。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/VerifyEmailBanner.tsx frontend/src/components/AppShell.tsx frontend/src/pages/Checkout.tsx
git commit -m "feat(auth): unverified banner + checkout gate prompt"
```

---

### Task 11: env 範本 + 端到端驗證 + 全測試

**Files:**
- Modify: `backend/.env.example`

- [ ] **Step 1: .env.example 加 Resend 區塊**

`backend/.env.example` 末尾加：
```
# --- Resend（交易信：驗證信/重設信）---
# 沒設 RESEND_API_KEY 時，後端不真的寄信，改把連結印到 console（本機/staging 用）
RESEND_API_KEY=
RESEND_FROM="屁TCG <noreply@pipicards.com>"
```

- [ ] **Step 2: 全後端測試**

Run: `cd backend && npx vitest run`
Expected: 全部 PASS（含既有 inventory/ecpay/kapai 與新增 auth-helpers/email）。

- [ ] **Step 3: 前端 build 驗證**

Run: `cd frontend && npx tsc --noEmit && npm run build`
Expected: 型別與 build 皆成功。

- [ ] **Step 4: 端到端（preview）驗證前端流程**

啟動前端 dev（後端用 Task 5 的 staging DB dev server），用 preview 工具：
- 開 `/register` → 填三欄（含確認密碼），故意讓兩次密碼不同 → 應顯示「兩次輸入的密碼不一致」。修正後送出 → 成功導向首頁，頂部出現黃色「信箱尚未驗證」banner。
- 後端 console 取得 `/verify-email?token=...`，瀏覽器開該網址 → 顯示「信箱驗證成功」，回首頁 banner 消失。
- `/login` 點「忘記密碼？」→ `/forgot-password` 輸入 email → 顯示「已寄出」訊息。
- 後端 console 取得 `/reset-password?token=...` → 開該網址設新密碼（兩次一致）→ 成功導向登入 → 用新密碼登入成功。

截圖佐證 register 確認密碼錯誤、未驗證 banner、重設成功三個畫面。

- [ ] **Step 5: Commit**

```bash
git add backend/.env.example
git commit -m "chore(auth): document RESEND env vars"
```

---

## 上線前置（需使用者授權，非自動化）

1. 使用者於 [resend.com](https://resend.com) 申請 `RESEND_API_KEY` 並提供。
2. Resend 加 `pipicards.com` 網域 → 取得 SPF/DKIM DNS 記錄 → 由 Claude 用 Cloudflare API 代加（需 Cloudflare API token 授權）。
3. 把 `RESEND_API_KEY`、`RESEND_FROM` 設到 Railway 兩個服務（`pptcg-backend-staging` + `pptcg-backend`）。
4. Merge `main` 後對 prod Neon（ep-autumn-dream）跑一次 `prisma db push`。

> 在金鑰/DNS 就緒前，後端走 console.log fallback，staging 即可完整驗證流程。

## Self-Review（規劃完成後自查）

- **Spec coverage：** 確認密碼(Task 8)、信箱驗證信+軟卡(Task 1/3/4/5/9/10)、忘記密碼/重設(Task 6/9)、Resend+fallback(Task 3)、限流(Task 5)、Google 自動驗證(Task 5)、測試(Task 2/3/11)、env(Task 11) — 全覆蓋。
- **Type consistency：** `createTokenPair/hashToken/isTokenUsable/buildAuthLink/canIssueReset` 簽名在 Task 2 定義、Task 5/6 使用一致；`code:'EMAIL_NOT_VERIFIED'` 後端(Task 4)與前端(Task 10)一致；`emailVerified` 欄位貫穿 schema/controller/type/banner 一致。

/**
 * LINE Messaging API Webhook Controller
 *
 * Receives events from LINE platform and dispatches responses.
 * Signature verification uses Channel Secret stored in the Setting table.
 *
 * LINE Webhook requirements:
 *  - Must respond 200 OK quickly (within 1s)
 *  - Signature in X-Line-Signature header: Base64(HMAC-SHA256(body, channelSecret))
 *  - Body must be parsed as raw Buffer for signature verification
 */

import { Request, Response } from 'express';
import { createHmac } from 'crypto';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

// ─── LINE API helpers ─────────────────────────────────────────

async function getLineSetting(key: string): Promise<string | null> {
  const s = await prisma.setting.findUnique({ where: { key } });
  return s?.value ?? null;
}

async function lineReply(replyToken: string, messages: object[], accessToken: string) {
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
}

export async function linePush(userId: string, messages: object[], accessToken: string) {
  await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ to: userId, messages }),
  });
}

// ─── Signature verification ───────────────────────────────────

function verifySignature(rawBody: Buffer, signature: string, secret: string): boolean {
  const digest = createHmac('SHA256', secret).update(rawBody).digest('base64');
  return digest === signature;
}

// ─── Event handlers ───────────────────────────────────────────

async function handleFollow(event: any, accessToken: string) {
  await lineReply(event.replyToken, [
    {
      type: 'text',
      text: '👋 歡迎加入卡報報！\n\n我會在發現卡拍拍有低於市價的套利機會時主動通知你。\n\n輸入「狀態」可以查看訂閱狀態。',
    },
  ], accessToken);
}

async function handleMessage(event: any, accessToken: string) {
  const text = (event.message?.text ?? '').trim();

  if (text === '狀態' || text === 'status') {
    const lineUid = event.source?.userId;
    const user = lineUid
      ? await prisma.user.findFirst({ where: { lineUid } })
      : null;

    if (!user) {
      await lineReply(event.replyToken, [{
        type: 'text',
        text: '⚠️ 你尚未綁定帳號。\n\n請到 pipicards.com 登入後，在會員頁面取得綁定碼，再回來輸入綁定碼。',
      }], accessToken);
      return;
    }

    await lineReply(event.replyToken, [{
      type: 'text',
      text: `✅ 已綁定帳號：${user.email}\n🔔 通知狀態：啟用中`,
    }], accessToken);
    return;
  }

  // Binding code: 6 alphanumeric chars
  if (/^[A-Z0-9]{6}$/.test(text.toUpperCase())) {
    await handleBindingCode(event, text.toUpperCase(), accessToken);
    return;
  }

  // Default reply
  await lineReply(event.replyToken, [{
    type: 'text',
    text: '🤖 卡報報\n\n可用指令：\n• 「狀態」— 查看訂閱狀態\n• 輸入 6 碼綁定碼 — 綁定 pipicards.com 帳號',
  }], accessToken);
}

async function handleBindingCode(event: any, code: string, accessToken: string) {
  const lineUid = event.source?.userId;
  if (!lineUid) return;

  // Find the pending bind token
  const pending = await prisma.lineBindToken.findUnique({ where: { code } });

  if (!pending) {
    await lineReply(event.replyToken, [{
      type: 'text',
      text: '❌ 綁定碼無效或已過期。\n請重新到 pipicards.com 產生新的綁定碼。',
    }], accessToken);
    return;
  }

  if (pending.expiresAt < new Date()) {
    await prisma.lineBindToken.delete({ where: { code } });
    await lineReply(event.replyToken, [{
      type: 'text',
      text: '⏰ 綁定碼已過期（有效期 10 分鐘）。\n請重新到 pipicards.com 產生新的綁定碼。',
    }], accessToken);
    return;
  }

  // Bind LINE UID to user
  await Promise.all([
    prisma.user.update({ where: { id: pending.userId }, data: { lineUid } }),
    prisma.lineBindToken.delete({ where: { code } }),
  ]);

  const user = await prisma.user.findUnique({ where: { id: pending.userId } });

  await lineReply(event.replyToken, [{
    type: 'text',
    text: `✅ 綁定成功！\n\n帳號：${user?.email ?? pending.userId}\n\n卡報報開始為你監控套利機會，有發現時會主動通知你 🎉`,
  }], accessToken);
}

// ─── User-facing endpoints ────────────────────────────────────

/** GET /api/line/info — public: return bot add link so the profile page can show it */
export async function lineInfo(_req: Request, res: Response) {
  const s = await prisma.setting.findUnique({ where: { key: 'LINE_BOT_LINK' } });
  res.json({ botLink: s?.value ?? null });
}

/** GET /api/line/status — authed: check binding */
export async function lineBindStatus(req: AuthRequest, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { lineUid: true },
  });
  res.json({ bound: !!user?.lineUid });
}

/** POST /api/line/bind-token — authed: generate 6-char code */
export async function lineGenBindToken(req: AuthRequest, res: Response) {
  const userId = req.userId!;
  await prisma.lineBindToken.deleteMany({ where: { userId } });
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
  await prisma.lineBindToken.create({ data: { code, userId, expiresAt } });
  res.json({ code, expiresAt });
}

/** DELETE /api/line/unbind — authed: remove LINE linkage */
export async function lineUnbind(req: AuthRequest, res: Response) {
  await prisma.user.update({ where: { id: req.userId! }, data: { lineUid: null } });
  res.json({ ok: true });
}

// ─── Main webhook handler ─────────────────────────────────────

export async function lineWebhook(req: Request, res: Response) {
  // Always respond 200 immediately — LINE retries if we're slow
  res.status(200).json({ status: 'ok' });

  try {
    const channelSecret = await getLineSetting('LINE_CHANNEL_SECRET');
    const accessToken   = await getLineSetting('LINE_CHANNEL_ACCESS_TOKEN');

    if (!channelSecret || !accessToken) {
      console.warn('[LINE] Missing credentials in Setting table');
      return;
    }

    // Verify signature
    const signature = req.headers['x-line-signature'] as string;
    const rawBody   = req.body as Buffer; // raw buffer from express.raw()

    if (!signature || !verifySignature(rawBody, signature, channelSecret)) {
      console.warn('[LINE] Invalid signature — ignoring');
      return;
    }

    const body   = JSON.parse(rawBody.toString('utf-8'));
    const events = body.events ?? [];

    for (const event of events) {
      if (event.type === 'follow') {
        await handleFollow(event, accessToken);
      } else if (event.type === 'message' && event.message?.type === 'text') {
        await handleMessage(event, accessToken);
      }
      // unfollow, postback, etc. — silently ignored for now
    }
  } catch (err) {
    console.error('[LINE] Webhook error:', err);
  }
}

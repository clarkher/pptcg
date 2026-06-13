import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';
import {
  createTokenPair, hashToken, isTokenUsable, buildAuthLink, canIssueReset,
  VERIFY_TTL_MS, RESET_TTL_MS,
} from '../lib/auth-helpers';
import { sendEmail, verificationEmailHtml, resetPasswordEmailHtml } from '../lib/email';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const FRONTEND = () => process.env.FRONTEND_URL || 'http://localhost:5173';

async function issueAndSendVerification(userId: string, email: string) {
  await prisma.authToken.updateMany({
    where: { userId, type: 'verify_email', usedAt: null },
    data: { usedAt: new Date() },
  });
  const { raw, tokenHash, expiresAt } = createTokenPair(VERIFY_TTL_MS);
  await prisma.authToken.create({ data: { userId, type: 'verify_email', tokenHash, expiresAt } });
  const link = buildAuthLink(FRONTEND(), '/verify-email', raw);
  const sent = await sendEmail({ to: email, subject: '驗證你的屁TCG信箱', html: verificationEmailHtml(link) });
  if (!sent) console.warn(`[auth] 驗證信寄送失敗 userId=${userId}`);
}

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
  // 寄驗證信為盡力而為：失敗不應讓註冊整個 500（使用者已建立，可登入後用 banner 重寄）
  try {
    await issueAndSendVerification(user.id, user.email);
  } catch (e) {
    console.warn(`[auth] 註冊後發驗證信流程失敗 userId=${user.id}`, e);
  }
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  res.json({ user, token });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
    res.status(401).json({ error: '帳號或密碼錯誤' });
    return;
  }
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  res.json({
    user: { id: user.id, email: user.email, username: user.username, isAdmin: user.isAdmin, emailVerified: user.emailVerified },
    token,
  });
}

export async function googleLogin(req: Request, res: Response) {
  const { credential } = req.body;
  if (!credential) {
    res.status(400).json({ error: '缺少 Google credential' });
    return;
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID!,
    });
    payload = ticket.getPayload();
  } catch {
    res.status(401).json({ error: 'Google 驗證失敗' });
    return;
  }

  if (!payload?.email) {
    res.status(401).json({ error: '無法取得 Google 帳號資訊' });
    return;
  }

  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId: payload.sub }, { email: payload.email }] },
  });

  if (!user) {
    const baseUsername = (payload.name ?? payload.email.split('@')[0])
      .replace(/\s+/g, '')
      .slice(0, 20);
    let username = baseUsername;
    let suffix = 1;
    while (await prisma.user.findUnique({ where: { username } })) {
      username = `${baseUsername}${suffix++}`;
    }
    user = await prisma.user.create({
      data: {
        email: payload.email,
        username,
        googleId: payload.sub,
        avatar: payload.picture ?? null,
        emailVerified: true,
      },
    });
  } else if (!user.googleId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId: payload.sub,
        avatar: user.avatar ?? payload.picture ?? null,
        emailVerified: true,
      },
    });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  res.json({
    user: { id: user.id, email: user.email, username: user.username, isAdmin: user.isAdmin, emailVerified: user.emailVerified },
    token,
  });
}

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

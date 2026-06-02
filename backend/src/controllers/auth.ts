import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function register(req: Request, res: Response) {
  const { email, username, password } = req.body;
  if (!email || !username || !password) {
    res.status(400).json({ error: '請填寫所有欄位' });
    return;
  }
  const exists = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });
  if (exists) {
    res.status(409).json({ error: 'Email 或帳號已存在' });
    return;
  }
  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, username, password: hashed },
    select: { id: true, email: true, username: true, wallet: true },
  });
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
    user: { id: user.id, email: user.email, username: user.username, wallet: user.wallet, isAdmin: user.isAdmin },
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
    const baseUsername = (payload.name || payload.email.split('@')[0]).replace(/\s+/g, '').slice(0, 20);
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
      },
    });
  } else if (!user.googleId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId: payload.sub, avatar: user.avatar ?? payload.picture ?? null },
    });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  res.json({
    user: { id: user.id, email: user.email, username: user.username, wallet: user.wallet, isAdmin: user.isAdmin },
    token,
  });
}

export async function me(req: AuthRequest, res: Response) {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { id: true, email: true, username: true, wallet: true, avatar: true, isAdmin: true },
  });
  if (!user) {
    res.status(404).json({ error: '使用者不存在' });
    return;
  }
  res.json(user);
}

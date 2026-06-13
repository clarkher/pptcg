import { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from './auth';

// 必須接在 authMiddleware 之後（依賴 req.userId）
export async function requireVerified(req: AuthRequest, res: Response, next: NextFunction) {
  // 防呆：若未接 authMiddleware（req.userId 為 undefined），避免用 undefined 查 Prisma 而拋 500
  if (!req.userId) {
    res.status(401).json({ error: '未授權，請先登入' });
    return;
  }
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

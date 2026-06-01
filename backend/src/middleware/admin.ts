import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { prisma } from '../lib/prisma';

export async function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.userId) {
    res.status(401).json({ error: '未授權' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user?.isAdmin) {
    res.status(403).json({ error: '需要管理員權限' });
    return;
  }
  next();
}

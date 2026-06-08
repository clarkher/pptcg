import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../middleware/auth';

export async function myNotifications(req: AuthRequest, res: Response) {
  res.json(await prisma.notification.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: 'desc' },
    take: 50,
  }));
}

export async function markRead(req: AuthRequest, res: Response) {
  const { id } = req.params as { id: string };
  await prisma.notification.updateMany({ where: { id, userId: req.userId! }, data: { read: true } });
  res.json({ ok: true });
}

export async function markAllRead(req: AuthRequest, res: Response) {
  await prisma.notification.updateMany({ where: { userId: req.userId!, read: false }, data: { read: true } });
  res.json({ ok: true });
}

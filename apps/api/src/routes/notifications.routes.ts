import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, ok } from '../http';
import { requireAuth, type AuthedRequest } from '../auth';
import { prisma } from '../prisma';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

notificationsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const notifications = await prisma.notification.findMany({
      where: {
        status: 'SENT',
        OR: [{ userId: req.userId }, { userId: null }],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return ok(res, notifications);
  }),
);

notificationsRouter.patch(
  '/:id/read',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = z.object({ isRead: z.boolean().default(true) }).parse(req.body ?? {});
    const notification = await prisma.notification.updateMany({
      where: {
        id: req.params.id,
        OR: [{ userId: req.userId }, { userId: null }],
      },
      data: { isRead: body.isRead },
    });

    return ok(res, { updated: notification.count });
  }),
);

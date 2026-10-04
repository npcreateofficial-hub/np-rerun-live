import net from 'node:net';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { AppError, asyncHandler, ok } from '../http';
import { requireAuth, type AuthedRequest } from '../auth';
import { canCreateWithinLimit, effectivePackage, getUsage, getUserWithPackage, limitsFromPackage, remainingForLimit } from '../limits';

export const proxiesRouter = Router();

proxiesRouter.use(requireAuth);

proxiesRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const items = await prisma.proxy.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, items);
  }),
);

proxiesRouter.get(
  '/usage',
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await getUserWithPackage(req.userId!);
    const limits = limitsFromPackage(effectivePackage(user));
    const usage = await getUsage(req.userId!);
    const remaining = remainingForLimit(limits.proxies, usage.proxies);
    return ok(res, { used: usage.proxies, limit: limits.proxies, remaining, canCreate: canCreateWithinLimit(limits.proxies, usage.proxies) });
  }),
);

const createSchema = z.object({
  host: z.string().min(1, 'กรุณากรอก host'),
  port: z.coerce.number().int().min(1).max(65535),
  username: z.string().optional(),
  password: z.string().optional(),
  note: z.string().optional(),
});

proxiesRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = createSchema.parse(req.body);

    const user = await getUserWithPackage(req.userId!);
    const limits = limitsFromPackage(effectivePackage(user));
    const usage = await getUsage(req.userId!);
    if (!canCreateWithinLimit(limits.proxies, usage.proxies)) throw new AppError('พร็อกซี่เต็มโควตาแพ็กเกจแล้ว', 403);

    const proxy = await prisma.proxy.create({
      data: { ...body, userId: req.userId! },
    });
    return ok(res, proxy, 'เพิ่มพร็อกซี่สำเร็จ', 201);
  }),
);

/** Basic TCP reachability check. */
function checkTcp(host: string, port: number, timeout = 5000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (result: boolean) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

proxiesRouter.post(
  '/:id/check',
  asyncHandler(async (req: AuthedRequest, res) => {
    const proxy = await prisma.proxy.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!proxy) throw new AppError('ไม่พบพร็อกซี่', 404);

    const alive = await checkTcp(proxy.host, proxy.port);
    const updated = await prisma.proxy.update({
      where: { id: proxy.id },
      data: { status: alive ? 'ACTIVE' : 'INACTIVE', checkedAt: new Date() },
    });
    return ok(res, updated, alive ? 'พร็อกซี่ใช้งานได้' : 'พร็อกซี่ใช้งานไม่ได้');
  }),
);

proxiesRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const proxy = await prisma.proxy.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!proxy) throw new AppError('ไม่พบพร็อกซี่', 404);
    await prisma.proxy.delete({ where: { id: proxy.id } });
    return ok(res, { deleted: true }, 'ลบพร็อกซี่สำเร็จ');
  }),
);

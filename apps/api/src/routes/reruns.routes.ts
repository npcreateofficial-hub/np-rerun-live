import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { AppError, asyncHandler, ok } from '../http';
import { requireAuth, type AuthedRequest } from '../auth';
import { effectivePackage, getUserWithPackage, limitsFromPackage } from '../limits';
import { isRunning } from '../rerun-engine';
import { ACTIVE_RERUN_STATES, rerunRelations, startRerunForChannel, stopRerunById } from '../rerun-service';
export const rerunsRouter = Router();

rerunsRouter.use(requireAuth);

const ACTIVE_STATES = ACTIVE_RERUN_STATES;

function publicRerun<T extends { rtmpUrl?: unknown; streamKey?: unknown } | null>(rerun: T) {
  if (!rerun) return rerun;
  const { rtmpUrl: _rtmpUrl, streamKey: _streamKey, ...safe } = rerun;
  return safe;
}

function publicReruns<T extends { rtmpUrl?: unknown; streamKey?: unknown }>(reruns: T[]) {
  return reruns.map((rerun) => publicRerun(rerun));
}

const withRelations = rerunRelations;

rerunsRouter.get(
  '/usage',
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await getUserWithPackage(req.userId!);
    const limits = limitsFromPackage(effectivePackage(user));
    const [active, used] = await Promise.all([
      prisma.rerun.count({ where: { userId: req.userId, status: { in: [...ACTIVE_STATES] } } }),
      prisma.rerun.count({ where: { userId: req.userId } }),
    ]);
    const limit = limits.liveChannels;
    const remaining = Math.max(0, limit - active);
    return ok(res, { active, used, limit, remaining, canStart: remaining > 0 });
  }),
);

rerunsRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const sessions = await prisma.rerun.findMany({
      where: { userId: req.userId },
      include: withRelations,
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, publicReruns(sessions));
  }),
);

rerunsRouter.get(
  '/active',
  asyncHandler(async (req: AuthedRequest, res) => {
    const sessions = await prisma.rerun.findMany({
      where: { userId: req.userId, status: { in: [...ACTIVE_STATES] } },
      include: withRelations,
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, publicReruns(sessions));
  }),
);

const stopSchema = z.object({ manual: z.boolean().optional() }).default({});

const startSchema = z
  .object({
    liveChannelId: z.string().optional(),
    accountId: z.string().optional(),
    videoId: z.string().min(1, 'กรุณาเลือกวิดีโอ'),
    title: z.string().optional(),
  })
  .refine((v) => v.liveChannelId || v.accountId, { message: 'กรุณาเลือกบัญชี' });

rerunsRouter.post(
  '/start',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = startSchema.parse(req.body);
    const liveChannelId = (body.liveChannelId ?? body.accountId)!;
    console.error('[reruns.start] body', { liveChannelId: req.body?.liveChannelId, accountId: req.body?.accountId, videoId: req.body?.videoId, user: req.userId });
    await prisma.liveChannel.updateMany({
      where: { id: liveChannelId, userId: req.userId! },
      data: { videoQueueIndex: 0 },
    });
      const full = await startRerunForChannel({
      userId: req.userId!,
      liveChannelId,
      videoId: body.videoId,
      title: body.title,
    });
      return ok(res, publicRerun(full), 'เริ่มรีรันสำเร็จ', 201);
  }),
);
rerunsRouter.post(
  '/:id/stop',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = stopSchema.parse(req.body ?? {});
    const full = await stopRerunById(req.userId!, req.params.id, { manual: body.manual === true });
    return ok(res, publicRerun(full), 'หยุดรีรันสำเร็จ');
  }),
);
rerunsRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const rerun = await prisma.rerun.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!rerun) throw new AppError('ไม่พบรอบรีรัน', 404);
    if (isRunning(rerun.id) || ACTIVE_STATES.includes(rerun.status as (typeof ACTIVE_STATES)[number])) {
      throw new AppError('ไม่สามารถลบรอบที่กำลังไลฟ์อยู่ กรุณาหยุดก่อน', 409);
    }
    await prisma.rerun.delete({ where: { id: rerun.id } });
    return ok(res, { deleted: true }, 'ลบประวัติรีรันสำเร็จ');
  }),
);

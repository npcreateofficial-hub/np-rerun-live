import { prisma } from './prisma';
import { startRerunForChannel, stopRerunById } from './rerun-service';
import { shopee } from './shopee';

const TICK_MS = Math.max(1_000, Number(process.env.RERUN_SCHEDULER_TICK_MS || 5_000));
const SHOPEE_MAX_LIVE_MINUTES = 23 * 60 + 59;
let timer: NodeJS.Timeout | null = null;
let running = false;

async function ensureScheduleColumns() {
  const columns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("LiveChannel")`);
  const names = new Set(columns.map((column) => column.name));
  if (!names.has('scheduledStartAt')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "LiveChannel" ADD COLUMN "scheduledStartAt" DATETIME`);
  }
  if (!names.has('scheduledStopAt')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "LiveChannel" ADD COLUMN "scheduledStopAt" DATETIME`);
  }
}

type ScheduledChannel = {
  id: string;
  userId: string;
  caption: string | null;
  isOnline: number | boolean;
  autoLive: number | boolean | null;
  liveDurationMinutes: number | null;
  restartDelayMinutes: number | null;
  videoQueueJson: string | null;
  scheduledStartAt: string | Date | null;
  scheduledStopAt: string | Date | null;
  cookie?: string | null;
  liveSessionId?: string | null;
};

type ActiveRerun = {
  id: string;
  userId: string;
  liveChannelId: string;
  videoId: string;
  startedAt: string | Date | null;
};

type VideoQueueItem = {
  videoId: string;
  durationMinutes: number;
  restartDelayMinutes: number;
  oneShot?: boolean;
};

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + Math.max(0, minutes) * 60_000);
}

function liveDurationLimitMinutes(value: number | null | undefined) {
  const requested = Number(value || 0);
  if (!Number.isFinite(requested) || requested <= 0) return SHOPEE_MAX_LIVE_MINUTES;
  return Math.min(requested, SHOPEE_MAX_LIVE_MINUTES);
}

function restartDelayMinutes(value: number | null | undefined) {
  const requested = Math.round(Number(value || 0));
  return Number.isFinite(requested) && requested > 0 ? requested : 0;
}

function parseVideoQueue(value?: string | null): VideoQueueItem[] {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    const items = Array.isArray(parsed) ? parsed : [];
    return items
      .map((item) => ({
        videoId: typeof item?.videoId === 'string' ? item.videoId : '',
        durationMinutes: liveDurationLimitMinutes(item?.durationMinutes),
        restartDelayMinutes: restartDelayMinutes(item?.restartDelayMinutes),
        oneShot: Boolean(item?.oneShot),
      }))
      .filter((item) => item.videoId);
  } catch {
    return [];
  }
}

function stringifyVideoQueue(items: VideoQueueItem[]) {
  return JSON.stringify(items.map((item) => ({
    videoId: item.videoId,
    durationMinutes: item.durationMinutes,
    restartDelayMinutes: item.restartDelayMinutes,
    ...(item.oneShot ? { oneShot: true } : {}),
  })));
}

function nextSchedulePatch(
  channel: Pick<ScheduledChannel, 'autoLive' | 'liveDurationMinutes' | 'restartDelayMinutes' | 'videoQueueJson'> | null,
  activeVideoId: string | null | undefined,
  now: Date,
) {
  if (!channel?.autoLive) return { scheduledStartAt: null, autoLive: false };

  const queue = parseVideoQueue(channel.videoQueueJson);
  const fallbackDuration = liveDurationLimitMinutes(channel.liveDurationMinutes);
  const fallbackDelay = restartDelayMinutes(channel.restartDelayMinutes);

  if (queue.length > 0) {
    const next = queue[0];
    return {
      scheduledStartAt: addMinutes(now, next.restartDelayMinutes || fallbackDelay),
      autoLive: true,
    };
  }

  if (!activeVideoId) return { scheduledStartAt: null, autoLive: false };

  return {
    scheduledStartAt: addMinutes(now, fallbackDelay),
    videoQueueJson: stringifyVideoQueue([{
      videoId: activeVideoId,
      durationMinutes: fallbackDuration,
      restartDelayMinutes: fallbackDelay,
      oneShot: true,
    }]),
    autoLive: true,
  };
}

async function startDueChannels(now: Date) {
  const channels = await prisma.$queryRawUnsafe<ScheduledChannel[]>(
    `SELECT id, userId, caption, isOnline, autoLive, liveDurationMinutes, restartDelayMinutes, videoQueueJson, scheduledStartAt, scheduledStopAt
     FROM "LiveChannel"
     WHERE autoLive = 1
       AND isOnline = 0
       AND scheduledStartAt IS NOT NULL
       AND scheduledStartAt <= ?`,
    now.toISOString(),
  );

  for (const channel of channels) {
    const queue = parseVideoQueue(channel.videoQueueJson);
    const queueItem = queue[0] ?? null;
    const video = queueItem
      ? await prisma.video.findFirst({ where: { id: queueItem.videoId, userId: channel.userId, status: 'READY' } })
      : await prisma.video.findFirst({
          where: { userId: channel.userId, liveChannelId: channel.id, status: 'READY' },
          orderBy: { updatedAt: 'desc' },
        });
    if (!video) {
      console.warn('[rerun-scheduler] no READY video for scheduled channel', { liveChannelId: channel.id, queuedVideoId: queueItem?.videoId ?? null });
      if (queueItem) {
        await prisma.liveChannel.update({
          where: { id: channel.id },
          data: {
            videoQueueJson: stringifyVideoQueue(queue.slice(1)),
            autoLive: queue.length > 1,
            scheduledStartAt: queue.length > 1 ? addMinutes(now, queue[1].restartDelayMinutes || restartDelayMinutes(channel.restartDelayMinutes)) : null,
          } as any,
        }).catch(() => undefined);
      }
      continue;
    }

    try {
      await startRerunForChannel({
        userId: channel.userId,
        liveChannelId: channel.id,
        videoId: video.id,
        title: channel.caption,
      });

      const remainingQueue = queueItem ? queue.slice(1) : queue;
      const durationMinutes = liveDurationLimitMinutes(queueItem?.durationMinutes ?? channel.liveDurationMinutes);
      const patch: Record<string, unknown> = {
        scheduledStartAt: null,
        scheduledStopAt: addMinutes(now, durationMinutes),
      };
      if (queueItem) {
        patch.videoQueueJson = stringifyVideoQueue(remainingQueue);
        patch.liveDurationMinutes = durationMinutes;
        patch.restartDelayMinutes = restartDelayMinutes(queueItem.restartDelayMinutes);
        patch.autoLive = remainingQueue.length > 0;
      }
      await prisma.liveChannel.update({ where: { id: channel.id }, data: patch as any });
      console.info('[rerun-scheduler] scheduled live started', { liveChannelId: channel.id, videoId: video.id, queued: Boolean(queueItem), remainingQueue: remainingQueue.length });
    } catch (error) {
      console.error('[rerun-scheduler] failed to start scheduled live', {
        liveChannelId: channel.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function stopDueChannels(now: Date) {
  const channels = await prisma.$queryRawUnsafe<ScheduledChannel[]>(
    `SELECT id, userId, autoLive, liveDurationMinutes, restartDelayMinutes, videoQueueJson, scheduledStopAt, cookie, liveSessionId
     FROM "LiveChannel"
     WHERE isOnline = 1
       AND scheduledStopAt IS NOT NULL
       AND scheduledStopAt <= ?`,
    now.toISOString(),
  );

  for (const channel of channels) {
    const active = await prisma.rerun.findFirst({
      where: { userId: channel.userId, liveChannelId: channel.id, status: { in: ['STARTING', 'LIVE', 'STOPPING'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!active) {
      try {
        if (channel.cookie && channel.liveSessionId) {
          await shopee.endSession(channel.cookie, channel.liveSessionId).catch(() => undefined);
        }
        const restartDelay = Number(channel.restartDelayMinutes || 0);
        await prisma.liveChannel.update({
          where: { id: channel.id },
          data: {
            isOnline: false,
            liveSessionId: null,
            rtmpUrl: null,
            streamKey: null,
            scheduledStopAt: null,
            ...nextSchedulePatch(channel, null, now),
          } as any,
        });
        console.warn('[rerun-scheduler] cleared scheduled live without active rerun', { liveChannelId: channel.id });
      } catch (error) {
        console.error('[rerun-scheduler] failed to clear scheduled live without active rerun', {
          liveChannelId: channel.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      continue;
    }

    try {
      await stopRerunById(channel.userId, active.id);
      await prisma.liveChannel.update({
        where: { id: channel.id },
        data: {
          scheduledStopAt: null,
          ...nextSchedulePatch(channel, active.videoId, now),
        } as any,
      });
      console.info('[rerun-scheduler] scheduled live stopped', { liveChannelId: channel.id, rerunId: active.id });
    } catch (error) {
      console.error('[rerun-scheduler] failed to stop scheduled live', {
        liveChannelId: channel.id,
        rerunId: active.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function stopByDuration(now: Date) {
  const activeReruns = await prisma.$queryRawUnsafe<ActiveRerun[]>(
    `SELECT r.id, r.userId, r.liveChannelId, r.videoId, r.startedAt
     FROM "Rerun" r
     WHERE r.status IN ('STARTING', 'LIVE')
       AND r.startedAt IS NOT NULL`,
  );

  for (const rerun of activeReruns) {
    const startedAt = rerun.startedAt ? new Date(rerun.startedAt) : null;
    if (!startedAt || Number.isNaN(startedAt.getTime())) continue;

    const channel = await prisma.liveChannel.findUnique({ where: { id: rerun.liveChannelId } });
    const limitMinutes = liveDurationLimitMinutes(channel?.liveDurationMinutes);
    const dueAt = addMinutes(startedAt, limitMinutes);
    if (dueAt > now) continue;

    try {
      await stopRerunById(rerun.userId, rerun.id);
      await prisma.liveChannel.update({
        where: { id: rerun.liveChannelId },
        data: {
          scheduledStopAt: null,
          ...nextSchedulePatch(channel, rerun.videoId, now),
        } as any,
      });
      console.info('[rerun-scheduler] live stopped by duration', { liveChannelId: rerun.liveChannelId, rerunId: rerun.id, limitMinutes });
    } catch (error) {
      console.error('[rerun-scheduler] failed to stop live by duration', {
        liveChannelId: rerun.liveChannelId,
        rerunId: rerun.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function tick() {
  if (running) return;
  running = true;
  const now = new Date();
  try {
    await startDueChannels(now);
    await stopDueChannels(now);
    await stopByDuration(now);
  } catch (error) {
    console.error('[rerun-scheduler] tick failed', error);
  } finally {
    running = false;
  }
}

export async function startRerunScheduler() {
  await ensureScheduleColumns();
  if (timer) return;
  timer = setInterval(() => void tick(), TICK_MS);
  timer.unref?.();
  void tick();
  console.log(`  Rerun scheduler: ON (${Math.round(TICK_MS / 1000)}s tick)`);
}



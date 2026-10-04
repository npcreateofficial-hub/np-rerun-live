import { prisma } from './prisma';
import { parseShopeeLiveSessionId, shopee } from './shopee';
import { revealSecret } from './secrets';

/**
 * Hourly sales = how much placedGmv grew during the last completed clock hour.
 * We snapshot each live session's total GMV at every :00 (and once when the live
 * starts) and report the difference between the two most recent snapshots.
 */

export type HourlySales = {
  hourlySales: number | null;
  hourlyFrom: string | null;
  hourlyTo: string | null;
  nextHourlySummaryAt: string;
};

function nextHourBoundary(from = new Date()): Date {
  const next = new Date(from);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next;
}

async function readTotalSales(cookie: string, sessionId: string): Promise<number | null> {
  try {
    const stats = await shopee.sessionStats(cookie, sessionId);
    return Number.isFinite(stats.totalSales) ? stats.totalSales : null;
  } catch {
    return null;
  }
}

/** Baseline snapshot taken right after a live starts (or resumes) so the first :00 summary has a start point. */
export async function captureStartSnapshot(liveChannelId: string, sessionId: string, cookie: string): Promise<void> {
  const existing = await prisma.liveGmvSnapshot.findFirst({ where: { liveChannelId, sessionId } }).catch(() => null);
  if (existing) return; // session already tracked (e.g. rerun restarted on the same Shopee session)
  const gmv = (await readTotalSales(cookie, sessionId)) ?? 0;
  await prisma.liveGmvSnapshot
    .create({ data: { liveChannelId, sessionId, capturedAt: new Date(), gmv } })
    .catch(() => undefined);
}

/** Snapshot every online channel at a clock-hour boundary. */
export async function captureHourlySnapshots(boundary: Date): Promise<void> {
  const channels = await prisma.liveChannel.findMany({
    where: { isOnline: true, liveSessionId: { not: null } },
    select: { id: true, cookie: true, liveSessionId: true },
  });

  for (const channel of channels) {
    const sessionId = parseShopeeLiveSessionId(channel.liveSessionId);
    const cookie = revealSecret(channel.cookie);
    if (!sessionId || !cookie) continue;
    const gmv = await readTotalSales(cookie, sessionId);
    if (gmv === null) {
      console.warn('[hourly-sales] skip snapshot, stats unavailable', { liveChannelId: channel.id, sessionId });
      continue;
    }
    await prisma.liveGmvSnapshot
      .create({ data: { liveChannelId: channel.id, sessionId, capturedAt: boundary, gmv } })
      .catch(() => undefined);
  }

  // Keep the table small: snapshots older than 7 days are no longer useful.
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.liveGmvSnapshot.deleteMany({ where: { capturedAt: { lt: cutoff } } }).catch(() => undefined);
}

export function startHourlySalesScheduler(): void {
  const schedule = () => {
    const boundary = nextHourBoundary();
    const delay = Math.max(1_000, boundary.getTime() - Date.now() + 1_500);
    const timer = setTimeout(() => {
      captureHourlySnapshots(boundary)
        .catch((error) => console.error('[hourly-sales] snapshot failed', error instanceof Error ? error.message : error))
        .finally(schedule);
    }, delay);
    timer.unref?.();
  };
  schedule();
}

export async function getHourlySales(liveChannelId: string, sessionId: string | null): Promise<HourlySales> {
  const nextHourlySummaryAt = nextHourBoundary().toISOString();
  if (!sessionId) return { hourlySales: null, hourlyFrom: null, hourlyTo: null, nextHourlySummaryAt };

  const snapshots = await prisma.liveGmvSnapshot
    .findMany({ where: { liveChannelId, sessionId }, orderBy: { capturedAt: 'desc' }, take: 2 })
    .catch(() => []);
  if (snapshots.length < 2) return { hourlySales: null, hourlyFrom: null, hourlyTo: null, nextHourlySummaryAt };

  const [latest, previous] = snapshots;
  return {
    hourlySales: Math.max(0, latest.gmv - previous.gmv),
    hourlyFrom: previous.capturedAt.toISOString(),
    hourlyTo: latest.capturedAt.toISOString(),
    nextHourlySummaryAt,
  };
}

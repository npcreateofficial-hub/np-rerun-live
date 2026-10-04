import { prisma } from './prisma';
import { AppError } from './http';
import { canCreateWithinLimit, effectivePackage, getUserWithPackage, limitsFromPackage } from './limits';
import { parseShopeeBasketItems, shopee } from './shopee';
import { resolveVideoInput, startRerunProcess, stopRerunProcess } from './rerun-engine';
import { startProductShowLoopForChannel, stopProductShowLoopForChannel } from './product-show-loop';
import { startAiCommentReplyLoopForChannel, stopAiCommentReplyLoopForChannel } from './ai-comment-reply-loop';

export const ACTIVE_RERUN_STATES = ['STARTING', 'LIVE', 'STOPPING'] as const;

export const rerunRelations = {
  liveChannel: {
    select: {
      id: true,
      name: true,
      isOnline: true,
      platform: true,
      accountName: true,
      shopId: true,
      platformUid: true,
      avatar: true,
      cookieValid: true,
      liveSessionId: true,
    },
  },
  video: { select: { id: true, title: true, status: true, sourceUrl: true, fileKey: true } },
} as const;

function toStartRerunError(message: string) {
  if (/err_code 90309999|load session Shopee|cookie|session/i.test(message)) {
    return new AppError('Shopee ไม่รับ session ของบัญชีนี้ กรุณาอัปเดตคุกกี้ Shopee ใหม่แล้วลองขึ้นไลฟ์อีกครั้ง', 400);
  }
  return new AppError(message, 502);
}
type StartRerunParams = {
  userId: string;
  liveChannelId: string;
  videoId: string;
  title?: string | null;
};

export async function startRerunForChannel({ userId, liveChannelId, videoId, title: inputTitle }: StartRerunParams) {
  const channel = await prisma.liveChannel.findFirst({ where: { id: liveChannelId, userId } });
  if (!channel) throw new AppError('ไม่พบบัญชีไลฟ์', 404);
  if (channel.cookieValid === false) throw new AppError('คุกกี้ของบัญชีนี้ใช้ไม่ได้ กรุณาเชื่อมบัญชีใหม่', 400);
  if (!channel.cookie) throw new AppError('บัญชีนี้ไม่มีคุกกี้', 400);
  if (!channel.coverImageUrl) throw new AppError('ยังไม่มีภาพปก กรุณากดจัดการ > แก้ไขข้อมูล แล้วเลือกรูปภาพหน้าปกก่อนขึ้นไลฟ์', 400);

  await prisma.rerun.updateMany({
    where: {
      liveChannelId,
      status: "STARTING",
      startedAt: null,
      OR: [
        { ffmpegPid: null },
        { createdAt: { lt: new Date(Date.now() - 30 * 1000) } },
      ],
    },
    data: {
      status: "FAILED",
      errorMessage: "เคลียร์สถานะ STARTING ค้างก่อนเริ่มรอบใหม่",
      stoppedAt: new Date(),
      ffmpegPid: null,
      rtmpUrl: null,
      streamKey: null,
    },
  });

  const alreadyActive = await prisma.rerun.findFirst({
    where: { liveChannelId, status: { in: [...ACTIVE_RERUN_STATES] } },
  });
  if (alreadyActive || channel.isOnline) throw new AppError('บัญชีนี้กำลังไลฟ์อยู่ ต้องหยุดรอบเดิมก่อน', 409);

  const video = await prisma.video.findFirst({ where: { id: videoId, userId } });
  if (!video) throw new AppError('ไม่พบวิดีโอ', 404);
  if (video.status !== 'READY') throw new AppError('วิดีโอยังไม่พร้อม (ต้องเป็นสถานะ READY)', 400);

  const input = resolveVideoInput(video);
  if (!input) throw new AppError('วิดีโอนี้ไม่มีไฟล์หรือ URL ต้นทางสำหรับสตรีม', 400);

  const user = await getUserWithPackage(userId);
  const limits = limitsFromPackage(effectivePackage(user));
  const activeCount = await prisma.rerun.count({
    where: { userId, status: { in: [...ACTIVE_RERUN_STATES] } },
  });
  if (!canCreateWithinLimit(limits.liveChannels, activeCount)) throw new AppError('จำนวนรีรันพร้อมกันเต็มโควตาแพ็กเกจแล้ว', 403);

  const title = channel.caption?.trim() || inputTitle?.trim() || video.title || 'รีรันไลฟ์';
  const description = channel.description?.trim() || channel.caption?.trim() || title;
  const basketItems = parseShopeeBasketItems(channel.basketLinks, channel.basketItemsJson);

  const rerun = await prisma.rerun.create({
    data: { userId, liveChannelId, videoId: video.id, title, status: 'STARTING' },
  });

  let ffmpegStarted = false;
  let publishedSession = false;
  let createdLiveSessionId: string | null = null;
  let shopeeSessionIsLive = false;
  let startedFromAlreadyLive = false;
  try {
    const session = await shopee.createSession(
      channel.cookie,
      title,
      channel.coverImageUrl,
      description,
      channel.liveSessionId,
      channel.platformUid,
      basketItems,
    );
    createdLiveSessionId = session.liveSessionId;
    shopeeSessionIsLive = Boolean(session.alreadyLive);

    await prisma.liveChannel.update({
      where: { id: channel.id },
      data: {
        liveSessionId: session.liveSessionId,
        rtmpUrl: session.rtmpUrl,
        streamKey: session.streamKey,
        isOnline: true,
      },
    });
    await prisma.rerun.update({
      where: { id: rerun.id },
      data: { rtmpUrl: session.rtmpUrl, streamKey: session.streamKey },
    });

    const startResult = await shopee.startSession(channel.cookie, session.liveSessionId);
    publishedSession = true;
    shopeeSessionIsLive = Boolean(startResult.isLive);
    startedFromAlreadyLive = Boolean(startResult.alreadyLive || session.alreadyLive);

    await startRerunProcess({
      rerunId: rerun.id,
      input,
      rtmpUrl: session.rtmpUrl,
      streamKey: session.streamKey,
    });
    ffmpegStarted = true;
    await startProductShowLoopForChannel(userId, channel.id).catch((error) => {
      console.warn('[product-show-loop] auto start skipped', {
        liveChannelId: channel.id,
        message: error instanceof Error ? error.message : String(error),
      });
    });
    await startAiCommentReplyLoopForChannel(userId, channel.id).catch((error) => {
      console.warn('[ai-comment-reply] auto start skipped', {
        liveChannelId: channel.id,
        message: error instanceof Error ? error.message : String(error),
      });
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'เริ่มรีรันไม่สำเร็จ';
    if (ffmpegStarted) await stopRerunProcess(rerun.id).catch(() => false);
    if (publishedSession && createdLiveSessionId && !startedFromAlreadyLive) {
      await shopee.endSession(channel.cookie, createdLiveSessionId).catch(() => undefined);
      shopeeSessionIsLive = false;
    }
    await prisma.rerun
      .update({
        where: { id: rerun.id },
        data: {
          status: 'FAILED',
          errorMessage: message,
          stoppedAt: new Date(),
          rtmpUrl: null,
          streamKey: null,
        },
      })
      .catch(() => undefined);
    await prisma.liveChannel
      .update({
        where: { id: channel.id },
        data: shopeeSessionIsLive && createdLiveSessionId
          ? {
              isOnline: true,
              liveSessionId: createdLiveSessionId,
            }
          : {
              isOnline: false,
              liveSessionId: null,
              rtmpUrl: null,
              streamKey: null,
            },
      })
      .catch(() => undefined);
    throw toStartRerunError(message);
  }

  return prisma.rerun.findUnique({ where: { id: rerun.id }, include: rerunRelations });
}

export async function stopRerunById(userId: string, rerunId: string, _options?: { manual?: boolean }) {
  const rerun = await prisma.rerun.findFirst({
    where: { id: rerunId, userId },
    include: { liveChannel: true },
  });
  if (!rerun) throw new AppError('ไม่พบรอบรีรัน', 404);
  await stopProductShowLoopForChannel(rerun.liveChannelId).catch(() => false);
  await stopAiCommentReplyLoopForChannel(rerun.liveChannelId).catch(() => false);

  if (rerun.liveChannel?.cookie && rerun.liveChannel.liveSessionId) {
    await Promise.race([
      shopee.endSession(rerun.liveChannel.cookie, rerun.liveChannel.liveSessionId),
      new Promise((_, reject) =>
        setTimeout(() => reject(new AppError('Shopee ใช้เวลาจบห้องนานเกินไป กรุณาลองหยุดอีกครั้ง', 504)), 45_000),
      ),
    ]);
  }

  const signalled = await stopRerunProcess(rerun.id);
  if (!signalled) {
    await prisma.rerun.update({
      where: { id: rerun.id },
      data: { status: 'ENDED', stoppedAt: new Date(), ffmpegPid: null },
    });
  }

  await prisma.liveChannel
    .update({
      where: { id: rerun.liveChannelId },
      data: {
        isOnline: false,
        liveSessionId: null,
        rtmpUrl: null,
        streamKey: null,
      },
    })
    .catch(() => undefined);

  return prisma.rerun.findUnique({ where: { id: rerun.id }, include: rerunRelations });
}

export async function resumeProductShowLoopsOnBoot() {
  // Product show-loop recovery is handled lazily by the live-channel routes in this build.
  return;
}


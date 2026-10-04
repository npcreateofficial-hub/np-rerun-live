import { generateCommentReply } from './comment-reply';
import { prisma } from './prisma';
import { revealSecret } from './secrets';
import { shopee, type ShopeeLiveComment } from './shopee';

const ACTIVE_COMMENT_RERUN_STATES = ['STARTING', 'LIVE', 'STOPPING'] as const;

type CommentReplyJob = {
  timer?: NodeJS.Timeout;
  running: boolean;
  cookie: string;
  sessionId: string;
  liveChannelId: string;
  apiKey?: string | null;
  basketItemsJson?: string | null;
  basketLinks?: string | null;
  channelName?: string | null;
  seen: Set<string>;
};

const commentReplyJobs = new Map<string, CommentReplyJob>();

function scheduleNextCommentReplyPoll(rerunId: string) {
  const job = commentReplyJobs.get(rerunId);
  if (!job) return;
  job.timer = setTimeout(() => void pollAndReplyToComments(rerunId), 5_000);
  job.timer.unref?.();
}

function shouldSkipComment(comment: ShopeeLiveComment, channelName?: string | null) {
  const text = comment.text.trim();
  if (!text) return true;
  if (/Shopee Live!/i.test(comment.customerName || text)) return true;
  if (channelName && comment.customerName && comment.customerName.trim() === channelName.trim()) return true;
  return false;
}

async function pollAndReplyToComments(rerunId: string) {
  const job = commentReplyJobs.get(rerunId);
  if (!job || job.running) return;
  job.running = true;
  try {
    const comments = await shopee.liveComments(job.cookie, job.sessionId);
    for (const comment of comments) {
      const seenKey = comment.id || `${comment.customerName || ''}:${comment.text}`;
      if (job.seen.has(seenKey)) continue;
      if (shouldSkipComment(comment, job.channelName)) {
        job.seen.add(seenKey);
        continue;
      }

      const reply = await generateCommentReply({
        comment: comment.text,
        customerName: comment.customerName,
        channelName: job.channelName,
        apiKey: job.apiKey,
        basketItemsJson: job.basketItemsJson,
        basketLinks: job.basketLinks,
      });
      const send = await shopee.sendLiveComment(job.cookie, job.sessionId, reply.reply);
      job.seen.add(seenKey);
      console.info('[comment-reply-loop] replied to live comment', {
        rerunId,
        liveChannelId: job.liveChannelId,
        sessionId: job.sessionId,
        commentId: seenKey,
        sent: send.sent,
        endpoint: send.endpoint,
      });
    }
  } catch (error) {
    console.warn('[comment-reply-loop] failed to poll/reply', {
      rerunId,
      liveChannelId: job.liveChannelId,
      sessionId: job.sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    const latest = commentReplyJobs.get(rerunId);
    if (latest) {
      latest.running = false;
      scheduleNextCommentReplyPoll(rerunId);
    }
  }
}

export function startCommentReplyLoop(params: {
  rerunId: string;
  liveChannelId: string;
  cookie: string;
  sessionId: string | null | undefined;
  apiKey?: string | null;
  basketItemsJson?: string | null;
  basketLinks?: string | null;
  channelName?: string | null;
}) {
  void stopCommentReplyLoop(params.rerunId);
  const sessionId = params.sessionId ? String(params.sessionId) : '';
  if (!params.cookie || !sessionId || !params.apiKey?.trim()) return;
  commentReplyJobs.set(params.rerunId, {
    running: false,
    cookie: params.cookie,
    sessionId,
    liveChannelId: params.liveChannelId,
    apiKey: params.apiKey,
    basketItemsJson: params.basketItemsJson,
    basketLinks: params.basketLinks,
    channelName: params.channelName,
    seen: new Set(),
  });
  void pollAndReplyToComments(params.rerunId);
  console.info('[comment-reply-loop] started', {
    rerunId: params.rerunId,
    liveChannelId: params.liveChannelId,
    sessionId,
  });
}

export function stopCommentReplyLoop(rerunId: string) {
  const job = commentReplyJobs.get(rerunId);
  if (!job) return;
  if (job.timer) clearTimeout(job.timer);
  commentReplyJobs.delete(rerunId);
  console.info('[comment-reply-loop] stopped', { rerunId, sessionId: job.sessionId });
}

export async function activeCommentReplyLoopForChannel(liveChannelId: string) {
  const rerun = await prisma.rerun.findFirst({
    where: { liveChannelId, status: { in: [...ACTIVE_COMMENT_RERUN_STATES] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (!rerun) return { running: false, rerunId: null as string | null };
  return { running: commentReplyJobs.has(rerun.id), rerunId: rerun.id };
}

export async function stopCommentReplyLoopForChannel(liveChannelId: string) {
  const rerun = await prisma.rerun.findFirst({
    where: { liveChannelId, status: { in: [...ACTIVE_COMMENT_RERUN_STATES] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (!rerun) return { running: false, stopped: false, rerunId: null as string | null };
  const wasRunning = commentReplyJobs.has(rerun.id);
  stopCommentReplyLoop(rerun.id);
  return { running: false, stopped: wasRunning, rerunId: rerun.id };
}

export async function syncCommentReplyLoopForChannel(liveChannelId: string) {
  const rerun = await prisma.rerun.findFirst({
    where: { liveChannelId, status: { in: [...ACTIVE_COMMENT_RERUN_STATES] } },
    orderBy: { createdAt: 'desc' },
    include: { liveChannel: true },
  });
  if (!rerun) return;
  const channel = rerun.liveChannel;
  const apiKey = revealSecret((channel as any)?.aiCommentApiKey);
  if (!channel?.aiCommentAutoReply || !channel.cookie || !channel.liveSessionId || !apiKey) {
    stopCommentReplyLoop(rerun.id);
    return;
  }
  startCommentReplyLoop({
    rerunId: rerun.id,
    liveChannelId,
    cookie: channel.cookie,
    sessionId: channel.liveSessionId,
    apiKey,
    basketItemsJson: channel.basketItemsJson,
    basketLinks: channel.basketLinks,
    channelName: channel.accountName || channel.name,
  });
}

export async function resumeCommentReplyLoopsOnBoot() {
  const active = await prisma.rerun.findMany({
    where: { status: { in: [...ACTIVE_COMMENT_RERUN_STATES] } },
    include: { liveChannel: true },
  });

  for (const rerun of active) {
    const channel = rerun.liveChannel;
    const apiKey = revealSecret((channel as any)?.aiCommentApiKey);
    if (!channel?.aiCommentAutoReply || !channel.cookie || !channel.liveSessionId || !apiKey) continue;
    startCommentReplyLoop({
      rerunId: rerun.id,
      liveChannelId: channel.id,
      cookie: channel.cookie,
      sessionId: channel.liveSessionId,
      apiKey,
      basketItemsJson: channel.basketItemsJson,
      basketLinks: channel.basketLinks,
      channelName: channel.accountName || channel.name,
    });
  }
}

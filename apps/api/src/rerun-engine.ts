import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import ffmpegStatic from 'ffmpeg-static';
import { config } from './config';
import { prisma } from './prisma';
import { resolveUploadPath } from './uploads';

type Job = {
  rerunId: string;
  proc: ChildProcessWithoutNullStreams;
  stderrTail: string[];
  stopping: boolean;
  logPath: string | null;
  input: string;
  rtmpUrl: string;
  streamKey?: string | null;
  restartAttempt: number;
};

const jobs = new Map<string, Job>();

function ffmpegBin(): string {
  return config.ffmpegPath || ffmpegStatic || 'ffmpeg';
}

/** Resolve a Video into an ffmpeg input (local uploaded file or remote URL). */
export function resolveVideoInput(video: { fileKey: string | null; sourceUrl: string | null }): string | null {
  if (video.fileKey) {
    const abs = resolveUploadPath(video.fileKey);
    if (fs.existsSync(abs)) return abs;
  }
  if (video.sourceUrl) return video.sourceUrl;
  return null;
}

/** Build the full RTMP destination from base url + optional stream key. */
export function buildRtmpTarget(rtmpUrl: string, streamKey?: string | null): string {
  if (!streamKey) return rtmpUrl;
  if (rtmpUrl.includes(streamKey)) return rtmpUrl;
  return `${rtmpUrl.replace(/\/+$/, '')}/${streamKey}`;
}

function buildArgs(input: string, target: string): string[] {
  const args: string[] = ['-hide_banner', '-loglevel', 'info', '-fflags', '+genpts', '-re'];

  if (config.rerunLoop) args.push('-stream_loop', '-1');

  args.push(
    '-i', input,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-profile:v', 'baseline',
    '-level:v', '3.1',
    '-pix_fmt', 'yuv420p',
    '-vf', 'scale=w=min(1280\\,iw):h=-2:force_original_aspect_ratio=decrease,fps=30',
    '-b:v', '2500k',
    '-maxrate', '2500k',
    '-bufsize', '5000k',
    '-g', '60',
    '-keyint_min', '60',
    '-sc_threshold', '0',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-f', 'flv',
    target,
  );

  return args;
}

export function isProcessAlive(pid?: number | null): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function ffmpegLogPath(rerunId: string) {
  const dir = path.join(config.uploadDir, 'ffmpeg-logs');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${rerunId}.log`);
}

function readLogTail(logPath: string | null, max = 1200) {
  if (!logPath) return '';
  try {
    const stat = fs.statSync(logPath);
    const size = Math.min(stat.size, max);
    const fd = fs.openSync(logPath, 'r');
    const buffer = Buffer.alloc(size);
    fs.readSync(fd, buffer, 0, size, Math.max(0, stat.size - size));
    fs.closeSync(fd);
    return buffer.toString('utf8');
  } catch {
    return '';
  }
}

export function isRunning(rerunId: string): boolean {
  return jobs.has(rerunId);
}

export type StartParams = {
  rerunId: string;
  input: string;
  rtmpUrl: string;
  streamKey?: string | null;
  restartAttempt?: number;
};

const ACTIVE_RERUN_STATES = ['STARTING', 'LIVE'] as const;

function restartDelayMs(attempt: number) {
  return Math.min(30_000, 2_000 + Math.max(0, attempt) * 5_000);
}

function scheduleFfmpegRestart(params: StartParams, logTail: string) {
  const nextAttempt = Math.max(0, params.restartAttempt ?? 0) + 1;
  const delayMs = restartDelayMs(nextAttempt);

  console.warn('[rerun-engine] ffmpeg exited unexpectedly; scheduling restart', {
    rerunId: params.rerunId,
    nextAttempt,
    delayMs,
  });

  void prisma.rerun
    .update({
      where: { id: params.rerunId },
      data: {
        status: 'STARTING',
        ffmpegPid: null,
        errorMessage: `FFmpeg หลุด กำลังเริ่มส่งวิดีโอใหม่อัตโนมัติ (ครั้งที่ ${nextAttempt})${logTail ? `: ${logTail.slice(-240)}` : ''}`,
      },
    })
    .catch(() => undefined);

  const timer = setTimeout(() => {
    void (async () => {
      const rerun = await prisma.rerun
        .findUnique({
          where: { id: params.rerunId },
          include: { liveChannel: { select: { id: true, isOnline: true } } },
        })
        .catch(() => null);
      if (!rerun || !ACTIVE_RERUN_STATES.includes(rerun.status as (typeof ACTIVE_RERUN_STATES)[number])) return;

      await startRerunProcess({ ...params, restartAttempt: nextAttempt }).catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        scheduleFfmpegRestart({ ...params, restartAttempt: nextAttempt }, message);
      });
    })();
  }, delayMs);
  timer.unref?.();
}

/**
 * Spawn FFmpeg to push the video to the RTMP endpoint.
 * Resolves after FFmpeg survives the startup handshake (status -> LIVE).
 * Runs until it exits or is stopped, then updates the Rerun row accordingly.
 */
export function startRerunProcess(params: StartParams): Promise<void> {
  const { rerunId, input, rtmpUrl, streamKey } = params;
  const target = buildRtmpTarget(rtmpUrl, streamKey);
  const args = buildArgs(input, target);
  const startupGraceMs = 8000;
  const bin = ffmpegBin();
  const logPath = ffmpegLogPath(rerunId);
  console.info('[rerun-engine] starting ffmpeg', { rerunId, input, ffmpeg: bin });

  return new Promise<void>((resolve, reject) => {
    let proc: ChildProcessWithoutNullStreams;
    let outFd: number | null = null;
    let errFd: number | null = null;
    try {
      outFd = fs.openSync(logPath, 'a');
      errFd = fs.openSync(logPath, 'a');
      proc = spawn(bin, args, {
        detached: true,
        windowsHide: true,
        stdio: ['ignore', outFd, errFd],
      }) as ChildProcessWithoutNullStreams;
      proc.unref();
    } catch (err) {
      if (outFd !== null) fs.closeSync(outFd);
      if (errFd !== null) fs.closeSync(errFd);
      console.error('[rerun-engine] ffmpeg spawn threw', {
        rerunId,
        message: err instanceof Error ? err.message : String(err),
      });
      reject(err);
      return;
    }
    if (outFd !== null) fs.closeSync(outFd);
    if (errFd !== null) fs.closeSync(errFd);

    const job: Job = {
      rerunId,
      proc,
      stderrTail: [],
      stopping: false,
      logPath,
      input,
      rtmpUrl,
      streamKey,
      restartAttempt: params.restartAttempt ?? 0,
    };
    jobs.set(rerunId, job);

    let settled = false;
    let startupTimer: NodeJS.Timeout | null = null;

    const settleStarted = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const markLive = () => {
      void (async () => {
        const existing = await prisma.rerun
          .findUnique({ where: { id: rerunId }, select: { startedAt: true } })
          .catch(() => null);
        const updated = await prisma.rerun
          .update({
            where: { id: rerunId },
            data: {
              status: 'LIVE',
              ffmpegPid: proc.pid ?? null,
              startedAt: existing?.startedAt ?? new Date(),
              stoppedAt: null,
              errorMessage: null,
            },
            select: { liveChannelId: true },
          })
          .catch(() => null);
        if (updated?.liveChannelId) {
          await prisma.liveChannel
            .update({ where: { id: updated.liveChannelId }, data: { isOnline: true } })
            .catch(() => undefined);
        }
      })().finally(settleStarted);
    };

    const failBeforeStarted = (message: string) => {
      if (startupTimer) {
        clearTimeout(startupTimer);
        startupTimer = null;
      }
      if (!settled) {
        settled = true;
        reject(new Error(message));
      }
    };

    proc.stderr?.on?.('data', (chunk: Buffer) => {
      const text = chunk.toString();
      job.stderrTail.push(text);
      if (job.stderrTail.length > 40) job.stderrTail.shift();
    });

    proc.on('spawn', () => {
      console.info('[rerun-engine] ffmpeg spawned', { rerunId, pid: proc.pid ?? null });
      startupTimer = setTimeout(markLive, startupGraceMs);
    });

    proc.on('error', (err) => {
      console.error('[rerun-engine] ffmpeg error', { rerunId, message: err.message });
      if (startupTimer) {
        clearTimeout(startupTimer);
        startupTimer = null;
      }
      jobs.delete(rerunId);
      void prisma.rerun
        .update({
          where: { id: rerunId },
          data: { status: 'FAILED', errorMessage: err.message, stoppedAt: new Date() },
        })
        .catch(() => undefined);
      if (!settled) {
        settled = true;
        reject(err);
      }
    });

    proc.on('close', (code, signal) => {
      console.info('[rerun-engine] ffmpeg closed', { rerunId, code, signal });
      if (startupTimer) {
        clearTimeout(startupTimer);
        startupTimer = null;
      }
      const job2 = jobs.get(rerunId);
      const wasStopping = job2?.stopping ?? false;
      jobs.delete(rerunId);
      const logTail = job2?.stderrTail.join('').slice(-1200) || readLogTail(job2?.logPath ?? logPath, 1200);

      if (!wasStopping && settled) {
        scheduleFfmpegRestart(
          {
            rerunId,
            input: job2?.input ?? input,
            rtmpUrl: job2?.rtmpUrl ?? rtmpUrl,
            streamKey: job2?.streamKey ?? streamKey,
            restartAttempt: job2?.restartAttempt ?? params.restartAttempt ?? 0,
          },
          logTail || `FFmpeg exited with code ${code}${signal ? ` signal ${signal}` : ``}`,
        );
        return;
      }

      void (async () => {
        const rerun = await prisma.rerun.findUnique({ where: { id: rerunId } }).catch(() => null);
        const startedAt = rerun?.startedAt ?? new Date();
        const durationSec = Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000));

        // Graceful stop, clean exit -> ENDED. Unexpected non-zero -> FAILED.
        const failed = !wasStopping && code !== 0;
        await prisma.rerun
          .update({
            where: { id: rerunId },
            data: {
              status: failed ? 'FAILED' : 'ENDED',
              stoppedAt: new Date(),
              durationSec,
              ffmpegPid: null,
              errorMessage: failed ? (logTail || `FFmpeg exited with code ${code}${signal ? ` signal ${signal}` : ``}`) : null,
            },
          })
          .catch(() => undefined);

        if (rerun?.liveChannelId) {
          await prisma.liveChannel
            .update({ where: { id: rerun.liveChannelId }, data: { isOnline: false, liveSessionId: null, rtmpUrl: null, streamKey: null } })
            .catch(() => undefined);
        }
      })();

      if (!settled) {
        // process ended before 'spawn' handler resolved — treat as failure
        failBeforeStarted(job.stderrTail.join('').slice(-500) || readLogTail(logPath, 500) || `FFmpeg exited early (code ${code})`);
      }
    });
  });
}

/** Stop a running rerun. Returns true if a process was found & signalled. */
export async function stopRerunProcess(rerunId: string): Promise<boolean> {
  const job = jobs.get(rerunId);
  if (!job) {
    const rerun = await prisma.rerun.findUnique({ where: { id: rerunId }, select: { ffmpegPid: true } }).catch(() => null);
    const pid = rerun?.ffmpegPid ?? null;
    if (!isProcessAlive(pid)) return false;

    await prisma.rerun.update({ where: { id: rerunId }, data: { status: 'STOPPING' } }).catch(() => undefined);
    process.kill(pid!, 'SIGINT');
    setTimeout(() => {
      if (isProcessAlive(pid)) process.kill(pid!, 'SIGKILL');
    }, 4000);
    return true;
  }

  job.stopping = true;
  await prisma.rerun.update({ where: { id: rerunId }, data: { status: 'STOPPING' } }).catch(() => undefined);

  // SIGINT lets ffmpeg flush; force kill shortly after if still alive.
  job.proc.kill('SIGINT');
  setTimeout(() => {
    if (jobs.has(rerunId)) job.proc.kill('SIGKILL');
  }, 4000);

  return true;
}

/**
 * On server boot, any Rerun left in STARTING/LIVE/STOPPING lost its FFmpeg child
 * (unless it was detached and is still alive). Try to resume the push with the
 * stored RTMP target; if that is not possible, mark the rerun ENDED and the
 * channel offline so a new live can be started without hitting the 409 guard.
 */
export async function reconcileOnBoot(): Promise<void> {
  const active = await prisma.rerun.findMany({
    where: { status: { in: ['STARTING', 'LIVE', 'STOPPING'] } },
    include: { video: { select: { fileKey: true, sourceUrl: true } } },
  });

  for (const item of active) {
    if (jobs.has(item.id)) continue;

    if (isProcessAlive(item.ffmpegPid)) {
      await prisma.rerun
        .update({ where: { id: item.id }, data: { status: 'LIVE', stoppedAt: null, errorMessage: null } })
        .catch(() => undefined);
      await prisma.liveChannel.update({ where: { id: item.liveChannelId }, data: { isOnline: true } }).catch(() => undefined);
      continue;
    }

    const input = resolveVideoInput(item.video);
    if (item.status !== 'STOPPING' && item.rtmpUrl && input) {
      try {
        await startRerunProcess({ rerunId: item.id, input, rtmpUrl: item.rtmpUrl, streamKey: item.streamKey });
        await prisma.liveChannel.update({ where: { id: item.liveChannelId }, data: { isOnline: true } }).catch(() => undefined);
        console.info('[rerun-engine] resumed rerun after boot', { rerunId: item.id });
        continue;
      } catch (error) {
        console.error('[rerun-engine] resume after boot failed', {
          rerunId: item.id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    await prisma.rerun
      .update({
        where: { id: item.id },
        data: {
          status: 'ENDED',
          ffmpegPid: null,
          stoppedAt: new Date(),
          errorMessage: 'ระบบรีสตาร์ท ไลฟ์รอบนี้จึงถูกปิด กรุณากดลงไลฟ์ใหม่',
        },
      })
      .catch(() => undefined);
    await prisma.liveChannel.update({ where: { id: item.liveChannelId }, data: { isOnline: false, liveSessionId: null, rtmpUrl: null, streamKey: null } }).catch(() => undefined);
    console.warn('[rerun-engine] closed stale rerun after boot', { rerunId: item.id });
  }
}





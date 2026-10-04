import path from 'node:path';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from './http';

type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const rateBuckets = new Map<string, Bucket>();
const allowedMediaExtensions = new Set(['.mp4', '.m4v', '.mov', '.webm', '.m3u8', '.ts', '.jpg', '.jpeg', '.png', '.webp']);

function clientKey(req: Request) {
  const forwarded = req.headers['x-forwarded-for'];
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  return (firstForwarded || req.ip || req.socket.remoteAddress || 'unknown').trim();
}

function cleanupRateBuckets(now: number) {
  if (rateBuckets.size < 10_000) return;
  for (const [key, bucket] of rateBuckets.entries()) {
    if (bucket.resetAt <= now) rateBuckets.delete(key);
  }
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  next();
}

export function noStoreApi(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('Cache-Control', 'no-store');
  next();
}

export function rateLimit({ windowMs, max, keyPrefix }: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') return next();

    const now = Date.now();
    cleanupRateBuckets(now);

    const key = `${keyPrefix}:${clientKey(req)}`;
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return next(new AppError('ส่งคำขอถี่เกินไป กรุณารอสักครู่แล้วลองใหม่', 429));
    }

    return next();
  };
}

export function mediaFileGuard(req: Request, _res: Response, next: NextFunction) {
  const rawPath = req.path || req.url || '';
  let decoded = rawPath;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    return next(new AppError('ชื่อไฟล์ไม่ถูกต้อง', 400));
  }

  const normalized = decoded.replace(/\\/g, '/').replace(/^\/+/, '');
  if (
    !normalized ||
    normalized.includes('\0') ||
    normalized.includes('..') ||
    normalized.startsWith('ffmpeg-logs/') ||
    path.isAbsolute(normalized)
  ) {
    return next(new AppError('ไม่อนุญาตให้เข้าถึงไฟล์นี้', 403));
  }

  const ext = path.extname(normalized).toLowerCase();
  if (!allowedMediaExtensions.has(ext)) {
    return next(new AppError('ไม่อนุญาตให้เข้าถึงไฟล์ประเภทนี้', 403));
  }

  return next();
}

import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

/** Standard success envelope expected by the frontend: { success, message, data }. */
export function ok<T>(res: Response, data: T, message = 'OK', status = 200) {
  return res.status(status).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
}

/** Application-level error carrying an HTTP status. */
export class AppError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.details = details;
  }
}

/** Wrap async route handlers so thrown errors reach the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ success: false, message: 'ไม่พบเส้นทางที่ร้องขอ', data: null });
}

function redactSensitive(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/(cookie|authorization|token|streamKey|stream_key|rtmpUrl|rtmp_url)=?[^,\s"}]+/gi, '$1=[REDACTED]')
      .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]');
  }

  if (Array.isArray(value)) return value.map(redactSensitive);

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) => {
      if (/cookie|authorization|token|secret|streamKey|stream_key|rtmpUrl|rtmp_url|password/i.test(key)) {
        return [key, '[REDACTED]'];
      }
      return [key, redactSensitive(item)];
    });
    return Object.fromEntries(entries);
  }

  return value;
}

function serializeError(err: unknown): unknown {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: redactSensitive(err.message),
      stack: redactSensitive(err.stack),
      cause: serializeError((err as Error & { cause?: unknown }).cause),
    };
  }
  return redactSensitive(err);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (
    typeof err === 'object' &&
    err &&
    'type' in err &&
    (err as { type?: string }).type === 'entity.too.large'
  ) {
    return res.status(413).json({
      success: false,
      message: 'ข้อมูลที่ส่งใหญ่เกินไป กรุณาลดขนาดรูปปกหรือไฟล์ที่แนบ',
      data: null,
    });
  }

  if (err instanceof ZodError) {
    const message = err.errors.map((e) => `${e.path.join('.') || 'field'}: ${e.message}`);
    return res.status(422).json({ success: false, message, data: null });
  }

  if (err instanceof AppError) {
    return res.status(err.status).json({ success: false, message: err.message, data: err.details ?? null });
  }

  // Prisma unique constraint
  if (typeof err === 'object' && err && 'code' in err && (err as { code?: string }).code === 'P2002') {
    return res.status(409).json({ success: false, message: 'ข้อมูลซ้ำกับที่มีอยู่แล้ว', data: null });
  }

  console.error('[unhandled error]', serializeError(err));
  return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดภายในระบบ', data: null });
}

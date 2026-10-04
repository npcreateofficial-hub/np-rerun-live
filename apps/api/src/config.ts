import 'dotenv/config';
import path from 'node:path';

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

const isProduction = process.env.NODE_ENV === 'production';
const rawCorsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:3000';
const corsOrigins = rawCorsOrigin === '*' ? (isProduction ? [] : true) : rawCorsOrigin.split(',').map((s) => s.trim()).filter(Boolean);
const accessSecret = process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret';
const refreshSecret = process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret';
const dataSecret = process.env.NP_DATA_SECRET ?? refreshSecret ?? accessSecret ?? 'dev-data-secret';

if (isProduction) {
  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    throw new Error('JWT_ACCESS_SECRET และ JWT_REFRESH_SECRET ต้องถูกตั้งค่าใน production');
  }
  if (!process.env.NP_DATA_SECRET) {
    throw new Error('NP_DATA_SECRET ต้องถูกตั้งค่าใน production เพื่อเข้ารหัสข้อมูลลับ');
  }
  if (accessSecret === refreshSecret || accessSecret.startsWith('dev-') || refreshSecret.startsWith('dev-')) {
    throw new Error('JWT secret สำหรับ production ต้องไม่ใช้ค่า dev และ access/refresh ต้องคนละค่า');
  }
  if (dataSecret.startsWith('dev-') || dataSecret === accessSecret || dataSecret === refreshSecret) {
    throw new Error('NP_DATA_SECRET สำหรับ production ต้องไม่ใช้ค่า dev และต้องแยกจาก JWT secret');
  }
  if (rawCorsOrigin === '*') {
    throw new Error('CORS_ORIGIN ห้ามเป็น * ใน production');
  }
}

export const config = {
  isProduction,
  port: num(process.env.PORT, 4000),
  host: process.env.HOST || (isProduction ? '127.0.0.1' : '0.0.0.0'),
  corsOrigin: rawCorsOrigin,
  corsOrigins,
  corsCredentials: rawCorsOrigin !== '*',
  dataSecret,
  jwt: {
    accessSecret,
    refreshSecret,
    accessTtl: num(process.env.JWT_ACCESS_TTL, 900),
    refreshTtl: num(process.env.JWT_REFRESH_TTL, 604800),
  },
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? './uploads'),
  uploadTimeoutMs: num(process.env.UPLOAD_TIMEOUT_MS, 4 * 60 * 60 * 1000),
  ffmpegPath: process.env.FFMPEG_PATH || null,
  rerunLoop: bool(process.env.RERUN_LOOP, true),
  shopeeLiveMode: bool(process.env.SHOPEE_LIVE_MODE, false),
};


import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from './config';
import { prisma } from './prisma';
import { AppError } from './http';

export type JwtPayload = { sub: string; role: string };

export type AuthedRequest = Request & { userId?: string; userRole?: string };

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export function signAccessToken(payload: JwtPayload) {
  return jwt.sign(payload, config.jwt.accessSecret, { expiresIn: config.jwt.accessTtl });
}

/** Refresh tokens are opaque random strings persisted in the DB (revocable). */
export function generateRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

export async function issueSession(userId: string, role: string) {
  const accessToken = signAccessToken({ sub: userId, role });
  const refreshToken = generateRefreshToken();
  const expiresAt = new Date(Date.now() + config.jwt.refreshTtl * 1000);

  await prisma.refreshToken.create({ data: { userId, token: refreshToken, expiresAt } });

  return { accessToken, refreshToken };
}

export async function rotateRefreshToken(oldToken: string) {
  const record = await prisma.refreshToken.findUnique({ where: { token: oldToken }, include: { user: true } });
  if (!record || record.expiresAt < new Date()) {
    if (record) await prisma.refreshToken.delete({ where: { id: record.id } }).catch(() => undefined);
    throw new AppError('Refresh token ไม่ถูกต้องหรือหมดอายุ', 401);
  }

  await prisma.refreshToken.delete({ where: { id: record.id } });
  const session = await issueSession(record.userId, record.user.role);
  return { ...session, user: record.user };
}

export async function revokeRefreshToken(token?: string | null) {
  if (!token) return;
  await prisma.refreshToken.deleteMany({ where: { token } });
}

/** Express middleware: require a valid Bearer access token. */
export function requireAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError('ต้องเข้าสู่ระบบก่อน', 401));
  }

  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret) as JwtPayload;
    req.userId = decoded.sub;
    req.userRole = decoded.role;
    return next();
  } catch {
    return next(new AppError('โทเคนไม่ถูกต้องหรือหมดอายุ', 401));
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      return next(new AppError('ไม่มีสิทธิ์เข้าถึง', 403));
    }
    return next();
  };
}

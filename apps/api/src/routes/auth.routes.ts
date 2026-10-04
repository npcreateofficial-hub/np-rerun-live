import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { AppError, asyncHandler, ok } from '../http';
import {
  hashPassword,
  issueSession,
  requireAuth,
  revokeRefreshToken,
  rotateRefreshToken,
  verifyPassword,
  type AuthedRequest,
} from '../auth';

export const authRouter = Router();

function normalizeLicenseKey(value?: string | null) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
}

function publicUser(user: {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  phone: string | null;
  profileImage: string | null;
  licenseKey?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  deviceBoundAt?: Date | null;
  deviceMoveLimit?: number;
  deviceMoveUsed?: number;
  deviceLockEnabled?: boolean;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    phone: user.phone,
    profileImage: user.profileImage,
    licenseKey: user.licenseKey ?? null,
    device: {
      id: user.deviceId ?? null,
      name: user.deviceName ?? null,
      boundAt: user.deviceBoundAt ?? null,
      moveLimit: user.deviceMoveLimit ?? 0,
      moveUsed: user.deviceMoveUsed ?? 0,
      lockEnabled: user.deviceLockEnabled ?? true,
    },
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function packageDeviceLimit(user: { package?: { maxDevices?: number | null } | null }) {
  const maxDevices = Number(user.package?.maxDevices ?? 1);
  return Number.isFinite(maxDevices) && maxDevices >= 0 ? Math.trunc(maxDevices) : 1;
}

const registerSchema = z.object({
  email: z.string().email('อีเมลไม่ถูกต้อง'),
  username: z.string().min(3).max(32).optional(),
  password: z
    .string()
    .min(8, 'รหัสผ่านอย่างน้อย 8 ตัวอักษร')
    .regex(/[A-Za-z]/, 'รหัสผ่านต้องมีตัวอักษร')
    .regex(/[0-9]/, 'รหัสผ่านต้องมีตัวเลข'),
});

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);

    const exists = await prisma.user.findFirst({
      where: { OR: [{ email: body.email }, ...(body.username ? [{ username: body.username }] : [])] },
    });
    if (exists) throw new AppError('อีเมลหรือชื่อผู้ใช้นี้ถูกใช้แล้ว', 409);

    const user = await prisma.user.create({
      data: {
        email: body.email,
        username: body.username ?? null,
        displayName: body.username ?? body.email.split('@')[0],
        passwordHash: await hashPassword(body.password),
      },
    });

    const session = await issueSession(user.id, user.role);
    return ok(res, { user: publicUser(user), ...session }, 'สมัครสมาชิกสำเร็จ', 201);
  }),
);

const loginSchema = z.object({
  licenseKey: z.string().optional().nullable(),
  username: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  password: z.string().min(1, 'กรุณากรอกรหัสผ่าน'),
  deviceId: z.string().optional().nullable(),
  deviceName: z.string().max(160).optional().nullable(),
});

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const loginName = (body.username || body.email || '').trim();
    if (!loginName) throw new AppError('กรุณากรอกชื่อผู้ใช้', 400);

    const looksLikeEmail = loginName.includes('@');
    const user = looksLikeEmail
      ? await prisma.user.findUnique({ where: { email: loginName }, include: { package: true, devices: true } }) ??
        await prisma.user.findUnique({ where: { username: loginName }, include: { package: true, devices: true } })
      : await prisma.user.findUnique({ where: { username: loginName }, include: { package: true, devices: true } }) ??
        await prisma.user.findUnique({ where: { email: loginName }, include: { package: true, devices: true } });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new AppError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 401);
    }
    if (!user.isActive) throw new AppError('บัญชีนี้ถูกระงับการใช้งาน', 403);

    let nextUser: Parameters<typeof publicUser>[0] = user;
    if (user.role !== 'ADMIN' && user.role !== 'STAFF') {
      if (!body.licenseKey?.trim()) throw new AppError('กรุณากรอก License', 400);
      if (!body.deviceId?.trim()) throw new AppError('ไม่พบรหัสเครื่อง กรุณารีเฟรชหน้าแล้วลองใหม่', 400);
      if (!user.licenseKey || normalizeLicenseKey(user.licenseKey) !== normalizeLicenseKey(body.licenseKey)) {
        throw new AppError('License ไม่ถูกต้องสำหรับบัญชีนี้', 401);
      }
    }

    if (user.role !== 'ADMIN' && user.role !== 'STAFF' && user.deviceLockEnabled) {
      const deviceId = body.deviceId?.trim();
      if (!deviceId) throw new AppError('ไม่พบรหัสเครื่อง กรุณารีเฟรชหน้าแล้วลองใหม่', 400);
      const deviceName = body.deviceName?.trim() || null;

      const deviceLimit = packageDeviceLimit(user);
      const legacyDevice = user.deviceId
        ? [{ deviceId: user.deviceId, name: user.deviceName, firstSeen: user.deviceBoundAt ?? new Date(), lastSeen: user.deviceBoundAt ?? new Date() }]
        : [];
      const knownDevices = user.devices.length ? user.devices : legacyDevice;
      const existingDevice = knownDevices.find((item) => item.deviceId === deviceId);

      if (existingDevice) {
        await prisma.userDevice.upsert({
          where: { userId_deviceId: { userId: user.id, deviceId } },
          create: { userId: user.id, deviceId, name: deviceName, firstSeen: existingDevice.firstSeen, lastSeen: new Date() },
          update: { name: deviceName ?? existingDevice.name ?? null, lastSeen: new Date() },
        });
        if (user.deviceId !== deviceId || (deviceName && user.deviceName !== deviceName)) {
          nextUser = await prisma.user.update({
            where: { id: user.id },
            data: { deviceId, deviceName, deviceBoundAt: existingDevice.firstSeen },
          });
        }
      } else if (!user.deviceId && knownDevices.length === 0) {
        nextUser = await prisma.user.update({
          where: { id: user.id },
          data: {
            deviceId,
            deviceName,
            deviceBoundAt: new Date(),
            deviceLockEnabled: true,
            deviceMoveLimit: 0,
            deviceMoveUsed: 0,
          },
        });
        await prisma.userDevice.create({
          data: { userId: user.id, deviceId, name: deviceName, firstSeen: new Date(), lastSeen: new Date() },
        });
      } else {
        const moveLimit = user.deviceMoveLimit ?? 0;
        const moveUsed = user.deviceMoveUsed ?? 0;
        const remainingManualMoves = Math.max(0, moveLimit - moveUsed);
        const allowedByPackage = deviceLimit <= 0 || knownDevices.length < deviceLimit;
        const allowedByManualMove = remainingManualMoves > 0;
        if (!allowedByPackage && !allowedByManualMove) {
          throw new AppError('รหัสนี้ถูกใช้งานกับเครื่องอื่นแล้ว กรุณาใช้เครื่องเดิม หรือติดต่อแอดมินให้ปลดเครื่องก่อน', 403);
        }
        nextUser = await prisma.user.update({
          where: { id: user.id },
          data: {
            deviceId,
            deviceName,
            deviceBoundAt: new Date(),
            deviceMoveUsed: allowedByPackage ? moveUsed : moveUsed + 1,
          },
        });
        await prisma.userDevice.create({
          data: { userId: user.id, deviceId, name: deviceName, firstSeen: new Date(), lastSeen: new Date() },
        });
      }
    }

    const session = await issueSession(nextUser.id, nextUser.role);
    return ok(res, { user: publicUser(nextUser), ...session }, 'เข้าสู่ระบบสำเร็จ');
  }),
);

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const session = await rotateRefreshToken(refreshToken);
    return ok(res, { accessToken: session.accessToken, refreshToken: session.refreshToken }, 'ต่ออายุเซสชันสำเร็จ');
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const refreshToken = (req.body?.refreshToken as string | undefined) ?? null;
    await revokeRefreshToken(refreshToken);
    return ok(res, { loggedOut: true }, 'ออกจากระบบสำเร็จ');
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) throw new AppError('ไม่พบผู้ใช้', 404);
    return ok(res, publicUser(user), 'OK');
  }),
);


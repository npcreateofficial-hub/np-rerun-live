import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { AppError, asyncHandler, ok } from '../http';
import { hashPassword, requireAuth, verifyPassword, type AuthedRequest } from '../auth';
import {
  daysLeft,
  canCreateWithinLimit,
  effectivePackage,
  getUsage,
  getUserWithPackage,
  limitsFromPackage,
  videoStorageCapacityBytes,
} from '../limits';

export const usersRouter = Router();

usersRouter.use(requireAuth);

async function buildPermissions(userId: string) {
  const user = await getUserWithPackage(userId);
  if (!user) throw new AppError('ไม่พบผู้ใช้', 404);

  const pkg = effectivePackage(user);
  const limits = limitsFromPackage(pkg);
  const usage = await getUsage(userId);

  return {
    package: {
      id: pkg?.id ?? null,
      code: pkg?.code ?? 'FREE',
      name: pkg?.name ?? 'ยังไม่มีแพ็กเกจ',
      expiresAt: user.packageExpiresAt,
      daysLeft: daysLeft(user.packageExpiresAt),
      limits,
    },
    usage: {
      accounts: usage.accounts,
      liveChannels: usage.liveChannels,
      videos: usage.videos,
      proxies: usage.proxies,
      storageGb: usage.storageGb,
    },
    canCreate: {
      account: canCreateWithinLimit(limits.accounts, usage.accounts),
      liveChannel: canCreateWithinLimit(limits.liveChannels, usage.liveChannels),
      proxy: canCreateWithinLimit(limits.proxies, usage.proxies),
      video: canCreateWithinLimit(limits.videos, usage.videos),
      storage: videoStorageCapacityBytes(limits) <= 0 || usage.storageBytes < videoStorageCapacityBytes(limits),
    },
  };
}

usersRouter.get(
  '/me',
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await getUserWithPackage(req.userId!);
    if (!user) throw new AppError('ไม่พบผู้ใช้', 404);
    const permissions = await buildPermissions(user.id);

    return ok(res, {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      phone: user.phone,
      profileImage: user.profileImage,
      role: user.role,
      isActive: user.isActive,
      credit: user.credit,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      packageId: user.packageId,
      packageStartedAt: user.packageStartedAt,
      packageExpiresAt: user.packageExpiresAt,
      package: effectivePackage(user),
      usage: permissions.usage,
      permissions,
    });
  }),
);

usersRouter.get(
  '/me/permissions',
  asyncHandler(async (req: AuthedRequest, res) => {
    return ok(res, await buildPermissions(req.userId!));
  }),
);

const profileSchema = z.object({
  email: z.string().email('อีเมลไม่ถูกต้อง').max(120).optional(),
  username: z.string().min(3).max(32).optional().nullable(),
  displayName: z.string().min(1).max(64).optional(),
  phone: z.string().max(40).optional().nullable(),
  profileImage: z.string().max(8_000_000).optional().nullable(),
}).strict();

usersRouter.patch(
  '/me/profile',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = profileSchema.parse(req.body);

    if (body.email) {
      const emailClash = await prisma.user.findFirst({
        where: { email: body.email, NOT: { id: req.userId } },
      });
      if (emailClash) throw new AppError('อีเมลนี้ถูกใช้แล้ว', 409);
    }

    if (body.username) {
      const usernameClash = await prisma.user.findFirst({
        where: { username: body.username, NOT: { id: req.userId } },
      });
      if (usernameClash) throw new AppError('ชื่อผู้ใช้นี้ถูกใช้แล้ว', 409);
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(typeof body.email !== 'undefined' ? { email: body.email } : {}),
        ...(typeof body.username !== 'undefined' ? { username: body.username || null } : {}),
        ...(typeof body.displayName !== 'undefined' ? { displayName: body.displayName } : {}),
        ...(typeof body.phone !== 'undefined' ? { phone: body.phone || null } : {}),
        ...(typeof body.profileImage !== 'undefined' ? { profileImage: body.profileImage || null } : {}),
      },
    });

    return ok(res, {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      phone: user.phone,
      profileImage: user.profileImage,
      role: user.role,
      isActive: user.isActive,
      credit: user.credit,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }, 'บันทึกข้อมูลสำเร็จ');
  }),
);

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, 'รหัสผ่านใหม่อย่างน้อย 8 ตัวอักษร')
    .regex(/[A-Za-z]/, 'รหัสผ่านใหม่ต้องมีตัวอักษร')
    .regex(/[0-9]/, 'รหัสผ่านใหม่ต้องมีตัวเลข'),
});

usersRouter.patch(
  '/me/password',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = passwordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) throw new AppError('ไม่พบผู้ใช้', 404);

    if (!(await verifyPassword(body.currentPassword, user.passwordHash))) {
      throw new AppError('รหัสผ่านปัจจุบันไม่ถูกต้อง', 400);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(body.newPassword) },
    });

    // revoke all refresh tokens after password change
    const revoked = await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    return ok(res, { passwordChanged: true, refreshTokensRevoked: revoked.count > 0 }, 'เปลี่ยนรหัสผ่านสำเร็จ');
  }),
);

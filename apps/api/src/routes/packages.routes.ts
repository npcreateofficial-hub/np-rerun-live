import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { AppError, asyncHandler, ok } from '../http';
import { requireAuth, type AuthedRequest } from '../auth';
import {
  daysLeft,
  effectivePackage,
  getUsage,
  getUserWithPackage,
  limitsFromPackage,
  videoStorageCapacityBytes,
} from '../limits';

export const packagesRouter = Router();

packagesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const packages = await prisma.package.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { priceBaht: 'asc' }],
    });
    return ok(res, packages);
  }),
);

packagesRouter.get(
  '/all',
  asyncHandler(async (_req, res) => {
    const packages = await prisma.package.findMany({
      orderBy: [{ sortOrder: 'asc' }, { priceBaht: 'asc' }],
    });
    return ok(res, packages);
  }),
);

packagesRouter.get(
  '/current',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await getUserWithPackage(req.userId!);
    if (!user) throw new AppError('ไม่พบผู้ใช้', 404);

    const pkg = effectivePackage(user);
    const limits = limitsFromPackage(pkg);
    const usage = await getUsage(user.id);

    return ok(res, {
      package: pkg,
      startedAt: user.packageStartedAt,
      expiresAt: user.packageExpiresAt,
      daysLeft: daysLeft(user.packageExpiresAt),
      usage: {
        storage: { used: usage.storageGb, total: Number((videoStorageCapacityBytes(limits) / (1024 * 1024 * 1024)).toFixed(4)) },
        accounts: { used: usage.accounts, total: limits.accounts },
        proxy: { used: usage.proxies, total: limits.proxies },
        live: { used: usage.liveChannels, total: limits.liveChannels },
        videos: { used: usage.videos, total: limits.videos },
      },
    });
  }),
);

const selectSchema = z.object({ packageId: z.string().optional() });

async function selectPackage(userId: string, packageId: string) {
  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  if (!pkg) throw new AppError('ไม่พบแพ็กเกจ', 404);

  const expiresAt = pkg.durationDays > 0 ? new Date(Date.now() + pkg.durationDays * 24 * 60 * 60 * 1000) : null;
  const user = await prisma.user.update({
    where: { id: userId },
    data: { packageId: pkg.id, packageStartedAt: new Date(), packageExpiresAt: expiresAt },
    include: { package: true },
  });

  return {
    message: `เลือกแพ็กเกจ ${pkg.name} สำเร็จ`,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      packageId: user.packageId,
      packageStartedAt: user.packageStartedAt,
      packageExpiresAt: user.packageExpiresAt,
      package: user.package,
    },
    package: pkg,
    current: {
      package: pkg,
      startedAt: user.packageStartedAt,
      expiresAt: user.packageExpiresAt,
      daysLeft: daysLeft(user.packageExpiresAt),
    },
  };
}

// POST /packages/:id/select  (primary path used by the frontend)
packagesRouter.post(
  '/:id/select',
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    return ok(res, await selectPackage(req.userId!, req.params.id), 'เลือกแพ็กเกจสำเร็จ');
  }),
);

// POST /packages/select  and  POST /packages/buy  (fallback paths)
for (const path of ['/select', '/buy']) {
  packagesRouter.post(
    path,
    requireAuth,
    asyncHandler(async (req: AuthedRequest, res) => {
      const { packageId } = selectSchema.parse(req.body);
      if (!packageId) throw new AppError('กรุณาระบุแพ็กเกจ', 400);
      return ok(res, await selectPackage(req.userId!, packageId), 'เลือกแพ็กเกจสำเร็จ');
    }),
  );
}

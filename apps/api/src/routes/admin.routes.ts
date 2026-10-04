import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { AppError, asyncHandler, ok } from '../http';
import { hashPassword, requireAuth, requireRole, type AuthedRequest } from '../auth';
import { createUploadImage } from '../uploads';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole('ADMIN', 'STAFF'));
adminRouter.use((req: AuthedRequest, _res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.userRole !== 'ADMIN') {
    return next(new AppError('เฉพาะผู้ดูแลระบบเท่านั้นที่แก้ไขข้อมูลส่วนนี้ได้', 403));
  }
  return next();
});

const nullableDate = z.preprocess((value) => {
  if (value === '' || value === null || typeof value === 'undefined') return null;
  if (value instanceof Date) return value;
  return new Date(String(value));
}, z.date().nullable());

const userSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  phone: true,
  profileImage: true,
  lineId: true,
  adminCustomerName: true,
  adminLineId: true,
  licenseKey: true,
  deviceId: true,
  deviceName: true,
  deviceBoundAt: true,
  deviceMoveLimit: true,
  deviceMoveUsed: true,
  deviceLockEnabled: true,
  marketingStatus: true,
  lastContactedAt: true,
  adminNote: true,
  role: true,
  isActive: true,
  credit: true,
  packageId: true,
  packageStartedAt: true,
  packageExpiresAt: true,
  createdAt: true,
  updatedAt: true,
  package: true,
  _count: {
    select: {
      liveChannels: true,
      videos: true,
      proxies: true,
      payments: true,
      notifications: true,
    },
  },
} as const;

const paymentUserSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  adminCustomerName: true,
  adminLineId: true,
} as const;

const packageCategory = z.preprocess((value) => {
  const normalized = String(value ?? 'STARTER').trim().toUpperCase().replace(/[-\s]+/g, '_');
  if (normalized === 'ULTRA_PRO' || normalized === 'ULTRAPRO') return 'PROMAX';
  return normalized;
}, z.enum(['STARTER', 'PRO', 'PROMAX']).default('STARTER'));

const packageDurationDays = z.preprocess((value) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < 0) return 0;
  return Math.trunc(numberValue);
}, z.number().int().min(0));

const packageBody = z.object({
  name: z.string().min(1).max(80),
  code: z.string().min(2).max(32).transform((value) => value.trim().toUpperCase()),
  category: packageCategory,
  description: z.string().max(300).optional().nullable(),
  priceBaht: z.coerce.number().min(0),
  durationDays: packageDurationDays,
  maxAccounts: z.coerce.number().int().min(0),
  maxLiveChannels: z.coerce.number().int().min(0),
  maxVideos: z.coerce.number().int().min(0),
  storageGb: z.coerce.number().int().min(0),
  maxDevices: z.coerce.number().int().min(0),
  maxProxies: z.coerce.number().int().min(0),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

const strongPassword = z
  .string()
  .min(8, 'รหัสผ่านอย่างน้อย 8 ตัวอักษร')
  .regex(/[A-Za-z]/, 'รหัสผ่านต้องมีตัวอักษร')
  .regex(/[0-9]/, 'รหัสผ่านต้องมีตัวเลข');

const createUserBody = z.object({
  email: z.string().email('อีเมลไม่ถูกต้อง').optional().nullable(),
  username: z.string().min(3).max(32).optional().nullable(),
  displayName: z.string().min(1).max(80).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  profileImage: z.string().max(8_000_000).optional().nullable(),
  lineId: z.string().max(80).optional().nullable(),
  adminCustomerName: z.string().max(80).optional().nullable(),
  adminLineId: z.string().max(80).optional().nullable(),
  licenseKey: z.string().min(1).max(80).optional().nullable(),
  deviceLockEnabled: z.boolean().default(true),
  deviceMoveLimit: z.coerce.number().int().min(0).default(0),
  marketingStatus: z.enum(['NEW', 'FOLLOW_UP', 'INTERESTED', 'RENEWED', 'PAUSED']).default('NEW'),
  lastContactedAt: nullableDate.optional(),
  adminNote: z.string().max(500).optional().nullable(),
  password: strongPassword,
  role: z.enum(['USER', 'ADMIN', 'STAFF']).default('USER'),
  isActive: z.boolean().default(true),
  credit: z.coerce.number().default(0),
  packageId: z.string().optional().nullable(),
  packageStartedAt: nullableDate.optional(),
  packageExpiresAt: nullableDate.optional(),
});

const updateUserBody = createUserBody
  .omit({ email: true, password: true })
  .extend({
    email: z.string().email('อีเมลไม่ถูกต้อง').optional(),
    password: strongPassword.optional().or(z.literal('')),
  })
  .partial();

const allowDeviceMoveBody = z.object({
  moves: z.coerce.number().int().min(1).max(50).default(1),
});

const notificationBody = z.object({
  userId: z.string().optional().nullable(),
  title: z.string().min(1).max(100),
  message: z.string().min(1).max(800),
  imageUrl: z.string().max(8_000_000).optional().nullable(),
  styleJson: z.string().max(20_000).optional().nullable(),
  ctaLabel: z.string().max(80).optional().nullable(),
  ctaUrl: z.string().max(2000).optional().nullable(),
  type: z.enum(['INFO', 'SUCCESS', 'WARNING', 'ERROR']).default('INFO'),
  status: z.enum(['DRAFT', 'SENT', 'ARCHIVED']).default('SENT'),
});

const paymentBody = z.object({
  status: z.enum(['PENDING', 'PAID', 'REJECTED']).optional(),
  reference: z.string().max(200).optional().nullable(),
});

const paymentSlipBody = z.object({
  userId: z.string().min(1),
});

const paymentSlipUpload = createUploadImage();
const notificationImageUpload = createUploadImage();

function packageExpiryFromStart(startedAt: Date, durationDays: number) {
  if (durationDays <= 0) return null;
  return new Date(startedAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
}

function internalCustomerEmail(username?: string | null, licenseKey?: string | null) {
  const identity = (username || licenseKey || '').trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${identity || `customer-${Date.now()}`}@nplive.local`;
}

const summaryQuery = z.object({
  preset: z.enum(['1', '7', '15', '30']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateParam(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveSummaryRange(query: unknown) {
  const parsed = summaryQuery.parse(query);
  const to = endOfDay(parseDateParam(parsed.to) ?? new Date());
  const presetDays = Number(parsed.preset ?? '7');
  const fromByPreset = new Date(to);
  fromByPreset.setDate(to.getDate() - Math.max(1, presetDays) + 1);
  const from = startOfDay(parseDateParam(parsed.from) ?? fromByPreset);

  if (from.getTime() > to.getTime()) {
    return { from: startOfDay(to), to: endOfDay(from), days: 1 };
  }

  const days = Math.max(1, Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / (24 * 60 * 60 * 1000)) + 1);
  return { from, to, days };
}

function buildDateSeries(from: Date, to: Date) {
  const rows: { date: string; label: string; revenueBaht: number; paid: number }[] = [];
  const cursor = startOfDay(from);
  const last = startOfDay(to);

  while (cursor.getTime() <= last.getTime()) {
    rows.push({ date: dateKey(cursor), label: cursor.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' }), revenueBaht: 0, paid: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  return rows;
}

async function ensurePackage(packageId?: string | null) {
  if (!packageId) return null;
  const pkg = await prisma.package.findUnique({ where: { id: packageId } });
  if (!pkg) throw new AppError('ไม่พบแพ็กเกจ', 404);
  return pkg;
}

adminRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const range = resolveSummaryRange(req.query);
    const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const [
      usersTotal,
      usersActive,
      usersExpired,
      packagesActive,
      liveOnline,
      videosReady,
      paymentsPaid,
      expiringSoon,
      expiringInThreeDays,
      paymentSum,
      packageRows,
      packages,
      marketingRows,
      paymentsInRange,
    ] =
      await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isActive: true } }),
        prisma.user.count({ where: { packageExpiresAt: { lt: now } } }),
        prisma.package.count({ where: { isActive: true } }),
        prisma.liveChannel.count({ where: { isOnline: true } }),
        prisma.video.count({ where: { status: 'READY' } }),
        prisma.payment.count({ where: { status: 'PAID' } }),
        prisma.user.count({
          where: {
            packageExpiresAt: {
              gte: now,
              lte: inSevenDays,
            },
          },
        }),
        prisma.user.count({
          where: {
            packageExpiresAt: {
              gte: now,
              lte: inThreeDays,
            },
          },
        }),
        prisma.payment.aggregate({
          where: { status: 'PAID' },
          _sum: { amountBaht: true },
        }),
        prisma.user.groupBy({ by: ['packageId'], _count: { _all: true } }),
        prisma.package.findMany({ select: { id: true, name: true, code: true, priceBaht: true, isActive: true } }),
        prisma.user.groupBy({ by: ['marketingStatus'], _count: { _all: true } }),
        prisma.payment.findMany({
          where: {
            status: 'PAID',
            createdAt: { gte: range.from, lte: range.to },
          },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            amountBaht: true,
            createdAt: true,
            user: {
              select: {
                packageId: true,
                package: { select: { id: true, name: true, code: true, priceBaht: true, isActive: true } },
              },
            },
          },
        }),
      ]);

    const packageNames = new Map(packages.map((pkg) => [pkg.id, pkg.name || pkg.code]));
    const series = buildDateSeries(range.from, range.to);
    const seriesByDate = new Map(series.map((row) => [row.date, row]));
    const packageSales = new Map(
      packages.map((pkg) => [
        pkg.id,
        {
          packageId: pkg.id,
          packageName: pkg.name || pkg.code,
          packageCode: pkg.code,
          isActive: pkg.isActive,
          priceBaht: pkg.priceBaht,
          paid: 0,
          revenueBaht: 0,
          customerCount: 0,
        },
      ]),
    );
    const unknownPackage = {
      packageId: null,
      packageName: 'ไม่ทราบแพ็กเกจ',
      packageCode: 'UNKNOWN',
      isActive: false,
      priceBaht: 0,
      paid: 0,
      revenueBaht: 0,
      customerCount: 0,
    };

    for (const payment of paymentsInRange) {
      const row = seriesByDate.get(dateKey(payment.createdAt));
      if (row) {
        row.paid += 1;
        row.revenueBaht += payment.amountBaht;
      }

      const matchedPackage =
        payment.user.package ??
        packages.find((pkg) => Math.abs(pkg.priceBaht - payment.amountBaht) < 0.01) ??
        null;
      const current = matchedPackage ? packageSales.get(matchedPackage.id) : unknownPackage;
      if (current) {
        current.paid += 1;
        current.revenueBaht += payment.amountBaht;
      }
    }

    const rangeRevenue = paymentsInRange.reduce((total, payment) => total + payment.amountBaht, 0);
    const rangePaid = paymentsInRange.length;
    for (const row of packageRows) {
      if (!row.packageId) continue;
      const current = packageSales.get(row.packageId);
      if (!current) continue;
      current.customerCount = row._count._all;
      if (current.paid === 0 && current.customerCount > 0) {
        current.revenueBaht = current.priceBaht * current.customerCount;
      }
    }

    const packageSalesRevenue = [...packageSales.values(), ...(unknownPackage.paid ? [unknownPackage] : [])].reduce(
      (total, row) => total + row.revenueBaht,
      0,
    );
    const packageSalesTotal = Math.max(rangeRevenue, packageSalesRevenue);
    const packageSalesRows = [...packageSales.values(), ...(unknownPackage.paid ? [unknownPackage] : [])]
      .sort((a, b) => b.revenueBaht - a.revenueBaht || b.paid - a.paid || b.customerCount - a.customerCount || a.packageName.localeCompare(b.packageName))
      .map((row, index) => ({
        ...row,
        sharePercent: packageSalesTotal ? Math.round((row.revenueBaht / packageSalesTotal) * 100) : 0,
        status: row.paid === 0 && row.customerCount === 0 ? 'NO_SALES' : index === 0 ? 'BEST' : 'SELLING',
      }));

    return ok(res, {
      users: { total: usersTotal, active: usersActive, expired: usersExpired, expiringSoon, expiringInThreeDays },
      packages: { active: packagesActive },
      live: { online: liveOnline },
      videos: { ready: videosReady },
      payments: { paid: paymentsPaid, revenueBaht: paymentSum._sum.amountBaht ?? 0 },
      packageBreakdown: packageRows.map((row) => ({
        packageId: row.packageId,
        packageName: row.packageId ? packageNames.get(row.packageId) ?? 'ไม่พบแพ็กเกจ' : 'ไม่มีแพ็กเกจ',
        count: row._count._all,
      })),
      marketing: Object.fromEntries(marketingRows.map((row) => [row.marketingStatus || 'NEW', row._count._all])),
      analytics: {
        range: {
          from: dateKey(range.from),
          to: dateKey(range.to),
          days: range.days,
        },
        sales: {
          revenueBaht: rangeRevenue,
          paid: rangePaid,
          averageOrderBaht: rangePaid ? Math.round(rangeRevenue / rangePaid) : 0,
          series,
        },
        packageSales: packageSalesRows,
      },
    });
  }),
);

adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const users = await prisma.user.findMany({
      where: search
        ? {
            OR: [
              { email: { contains: search } },
              { username: { contains: search } },
              { displayName: { contains: search } },
              { phone: { contains: search } },
              { lineId: { contains: search } },
              { adminCustomerName: { contains: search } },
              { adminLineId: { contains: search } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      select: userSelect,
    });

    return ok(res, users);
  }),
);

adminRouter.post(
  '/users',
  asyncHandler(async (req, res) => {
    const body = createUserBody.parse(req.body);
    const pkg = await ensurePackage(body.packageId);
    const packageStartedAt = body.packageStartedAt ?? (pkg ? new Date() : null);
    const packageExpiresAt = body.packageExpiresAt ?? (pkg && packageStartedAt ? packageExpiryFromStart(packageStartedAt, pkg.durationDays) : null);
    const licenseKey = body.licenseKey?.trim() || null;
    const username = body.username?.trim() || null;
    const email = body.email?.trim() || internalCustomerEmail(username, licenseKey);
    if (licenseKey) {
      const licenseExists = await prisma.user.findFirst({ where: { licenseKey }, select: { id: true } });
      if (licenseExists) throw new AppError('License นี้ถูกใช้แล้ว', 409);
    }

    const user = await prisma.user.create({
      data: {
        email,
        username,
        displayName: body.displayName || username || email.split('@')[0],
        phone: body.phone || null,
        profileImage: body.profileImage || null,
        lineId: body.lineId || null,
        adminCustomerName: body.adminCustomerName || null,
        adminLineId: body.adminLineId || null,
        licenseKey,
        deviceLockEnabled: body.deviceLockEnabled,
        deviceMoveLimit: body.deviceMoveLimit,
        deviceMoveUsed: 0,
        marketingStatus: body.marketingStatus,
        lastContactedAt: body.lastContactedAt ?? null,
        adminNote: body.adminNote || null,
        passwordHash: await hashPassword(body.password),
        role: body.role,
        isActive: body.isActive,
        credit: body.credit,
        packageId: pkg?.id ?? null,
        packageStartedAt,
        packageExpiresAt,
      },
      select: userSelect,
    });

    return ok(res, user, 'สร้างผู้ใช้สำเร็จ', 201);
  }),
);

adminRouter.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const body = updateUserBody.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('ไม่พบผู้ใช้', 404);

    const pkg = 'packageId' in body ? await ensurePackage(body.packageId) : undefined;
    const nextPackageId = 'packageId' in body ? pkg?.id ?? null : existing.packageId;
    const startedAt =
      'packageStartedAt' in body
        ? body.packageStartedAt ?? null
        : 'packageId' in body && pkg && !existing.packageStartedAt
          ? new Date()
          : existing.packageStartedAt;
    const expiresAt =
      'packageExpiresAt' in body
        ? body.packageExpiresAt ?? null
        : 'packageId' in body && pkg && startedAt
          ? packageExpiryFromStart(startedAt, pkg.durationDays)
          : existing.packageExpiresAt;
    const licenseKey = typeof body.licenseKey !== 'undefined' ? body.licenseKey?.trim() || null : undefined;
    if (licenseKey && licenseKey !== existing.licenseKey) {
      const licenseExists = await prisma.user.findFirst({ where: { licenseKey, NOT: { id: existing.id } }, select: { id: true } });
      if (licenseExists) throw new AppError('License นี้ถูกใช้แล้ว', 409);
    }

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(typeof body.email !== 'undefined' ? { email: body.email } : {}),
        ...(typeof body.username !== 'undefined' ? { username: body.username || null } : {}),
        ...(typeof body.displayName !== 'undefined' ? { displayName: body.displayName || null } : {}),
        ...(typeof body.phone !== 'undefined' ? { phone: body.phone || null } : {}),
        ...(typeof body.profileImage !== 'undefined' ? { profileImage: body.profileImage || null } : {}),
        ...(typeof body.lineId !== 'undefined' ? { lineId: body.lineId || null } : {}),
        ...(typeof body.adminCustomerName !== 'undefined' ? { adminCustomerName: body.adminCustomerName || null } : {}),
        ...(typeof body.adminLineId !== 'undefined' ? { adminLineId: body.adminLineId || null } : {}),
        ...(typeof licenseKey !== 'undefined' ? { licenseKey } : {}),
        ...(typeof body.deviceLockEnabled !== 'undefined' ? { deviceLockEnabled: body.deviceLockEnabled } : {}),
        ...(typeof body.deviceMoveLimit !== 'undefined' ? { deviceMoveLimit: body.deviceMoveLimit } : {}),
        ...(typeof body.marketingStatus !== 'undefined' ? { marketingStatus: body.marketingStatus } : {}),
        ...(typeof body.lastContactedAt !== 'undefined' ? { lastContactedAt: body.lastContactedAt ?? null } : {}),
        ...(typeof body.adminNote !== 'undefined' ? { adminNote: body.adminNote || null } : {}),
        ...(typeof body.role !== 'undefined' ? { role: body.role } : {}),
        ...(typeof body.isActive !== 'undefined' ? { isActive: body.isActive } : {}),
        ...(typeof body.credit !== 'undefined' ? { credit: body.credit } : {}),
        ...('packageId' in body || 'packageStartedAt' in body || 'packageExpiresAt' in body
          ? { packageId: nextPackageId, packageStartedAt: startedAt, packageExpiresAt: expiresAt }
          : {}),
        ...(body.password ? { passwordHash: await hashPassword(body.password) } : {}),
      },
      select: userSelect,
    });

    return ok(res, user, 'บันทึกผู้ใช้สำเร็จ');
  }),
);

adminRouter.post(
  '/users/:id/unlock-device',
  asyncHandler(async (req, res) => {
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('ไม่พบผู้ใช้', 404);

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        deviceId: null,
        deviceName: null,
        deviceBoundAt: null,
        deviceMoveUsed: 0,
      },
      select: userSelect,
    });

    return ok(res, user, 'ปลดเครื่องเรียบร้อย');
  }),
);

adminRouter.post(
  '/users/:id/device/allow-move',
  asyncHandler(async (req, res) => {
    const body = allowDeviceMoveBody.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError('ไม่พบผู้ใช้', 404);

    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        deviceLockEnabled: true,
        deviceMoveLimit: (existing.deviceMoveLimit ?? 0) + body.moves,
      },
      select: userSelect,
    });

    return ok(res, user, `อนุญาตให้ล็อกอินเครื่องอื่นเพิ่ม ${body.moves} ครั้งแล้ว`);
  }),
);

adminRouter.get(
  '/packages',
  asyncHandler(async (_req, res) => {
    const packages = await prisma.package.findMany({
      orderBy: [{ sortOrder: 'asc' }, { priceBaht: 'asc' }, { createdAt: 'desc' }],
      include: { _count: { select: { users: true } } },
    });
    return ok(res, packages);
  }),
);

adminRouter.post(
  '/packages',
  asyncHandler(async (req, res) => {
    const body = packageBody.parse(req.body);
    const pkg = await prisma.package.create({
      data: { ...body, description: body.description || null, isActive: body.isActive ?? true, sortOrder: body.sortOrder ?? 0 },
      include: { _count: { select: { users: true } } },
    });
    return ok(res, pkg, 'สร้างแพ็กเกจสำเร็จ', 201);
  }),
);

adminRouter.patch(
  '/packages/:id',
  asyncHandler(async (req, res) => {
    const body = packageBody.partial().parse(req.body);
    const pkg = await prisma.package.update({
      where: { id: req.params.id },
      data: {
        ...body,
        ...(typeof body.description !== 'undefined' ? { description: body.description || null } : {}),
      },
      include: { _count: { select: { users: true } } },
    });
    return ok(res, pkg, 'บันทึกแพ็กเกจสำเร็จ');
  }),
);

adminRouter.delete(
  '/packages/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.package.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { users: true } } },
    });
    if (!existing) throw new AppError('ไม่พบแพ็กเกจ', 404);

    const [detachedUsers] = await prisma.$transaction([
      prisma.user.updateMany({
        where: { packageId: existing.id },
        data: { packageId: null, packageStartedAt: null, packageExpiresAt: null },
      }),
      prisma.package.delete({ where: { id: existing.id } }),
    ]);

    return ok(
      res,
      { deleted: true, packageId: existing.id, detachedUsers: detachedUsers.count },
      detachedUsers.count > 0
        ? `ลบแพ็กเกจสำเร็จ และปลดลูกค้า ${detachedUsers.count} บัญชีออกจากแพ็กเกจนี้แล้ว`
        : 'ลบแพ็กเกจสำเร็จ',
    );
  }),
);

adminRouter.get(
  '/notifications',
  asyncHandler(async (_req, res) => {
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, email: true, username: true, displayName: true } } },
      take: 100,
    });
    return ok(res, notifications);
  }),
);

adminRouter.post(
  '/notifications/upload-image',
  notificationImageUpload.single('image'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw new AppError('กรุณาเลือกรูปแจ้งเตือน', 400);

    return ok(res, { imageUrl: `/uploads/${path.basename(file.path)}` }, 'อัปโหลดรูปแจ้งเตือนสำเร็จ', 201);
  }),
);

adminRouter.post(
  '/notifications',
  asyncHandler(async (req, res) => {
    const body = notificationBody.parse(req.body);
    if (body.userId) {
      const user = await prisma.user.findUnique({ where: { id: body.userId } });
      if (!user) throw new AppError('ไม่พบผู้ใช้ปลายทาง', 404);
    }

    const notification = await prisma.notification.create({
      data: {
        userId: body.userId || null,
        title: body.title,
        message: body.message,
        imageUrl: body.imageUrl || null,
        styleJson: body.styleJson || null,
        ctaLabel: body.ctaLabel || null,
        ctaUrl: body.ctaUrl || null,
        type: body.type,
        status: body.status,
      },
      include: { user: { select: { id: true, email: true, username: true, displayName: true } } },
    });
    return ok(res, notification, 'สร้างแจ้งเตือนสำเร็จ', 201);
  }),
);

adminRouter.patch(
  '/notifications/:id',
  asyncHandler(async (req, res) => {
    const body = notificationBody.partial().extend({ isRead: z.boolean().optional() }).parse(req.body);
    const notification = await prisma.notification.update({
      where: { id: req.params.id },
      data: {
        ...body,
        ...(typeof body.userId !== 'undefined' ? { userId: body.userId || null } : {}),
        ...(typeof body.imageUrl !== 'undefined' ? { imageUrl: body.imageUrl || null } : {}),
        ...(typeof body.styleJson !== 'undefined' ? { styleJson: body.styleJson || null } : {}),
        ...(typeof body.ctaLabel !== 'undefined' ? { ctaLabel: body.ctaLabel || null } : {}),
        ...(typeof body.ctaUrl !== 'undefined' ? { ctaUrl: body.ctaUrl || null } : {}),
      },
      include: { user: { select: { id: true, email: true, username: true, displayName: true } } },
    });
    return ok(res, notification, 'บันทึกแจ้งเตือนสำเร็จ');
  }),
);

adminRouter.delete(
  '/notifications/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.notification.findUnique({ where: { id: req.params.id }, select: { id: true } });
    if (!existing) throw new AppError('ไม่พบแจ้งเตือนที่ต้องการลบ', 404);

    await prisma.notification.delete({ where: { id: existing.id } });
    return ok(res, { deleted: true, notificationId: existing.id }, 'ลบแจ้งเตือนสำเร็จ');
  }),
);

adminRouter.get(
  '/sales',
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const inSevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const [expiringUsers, expiredUsers, recentPayments] = await Promise.all([
      prisma.user.findMany({
        where: { packageExpiresAt: { gte: now, lte: inSevenDays } },
        orderBy: { packageExpiresAt: 'asc' },
        take: 30,
        select: userSelect,
      }),
      prisma.user.findMany({
        where: { packageExpiresAt: { lt: now } },
        orderBy: { packageExpiresAt: 'desc' },
        take: 30,
        select: userSelect,
      }),
      prisma.payment.findMany({
        orderBy: { createdAt: 'desc' },
        include: { user: { select: paymentUserSelect } },
        take: 20,
      }),
    ]);

    return ok(res, { expiringUsers, expiredUsers, recentPayments });
  }),
);

adminRouter.get(
  '/payments',
  asyncHandler(async (_req, res) => {
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      include: { user: { select: paymentUserSelect } },
      take: 100,
    });
    return ok(res, payments);
  }),
);

adminRouter.post(
  '/payments',
  paymentSlipUpload.single('slip'),
  asyncHandler(async (req, res) => {
    const body = paymentSlipBody.parse(req.body);
    const file = req.file;
    if (!file) throw new AppError('กรุณาเลือกรูปสลิป', 400);

    const user = await prisma.user.findUnique({ where: { id: body.userId } });
    if (!user) throw new AppError('ไม่พบลูกค้า', 404);

    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        amountBaht: 0,
        method: 'SLIP',
        status: 'PAID',
        reference: null,
        slipImageUrl: `/uploads/${path.basename(file.path)}`,
      },
      include: { user: { select: paymentUserSelect } },
    });

    return ok(res, payment, 'บันทึกสลิปแล้ว', 201);
  }),
);

adminRouter.patch(
  '/payments/:id',
  asyncHandler(async (req, res) => {
    const body = paymentBody.parse(req.body);
    const payment = await prisma.payment.findUnique({ where: { id: req.params.id } });
    if (!payment) throw new AppError('ไม่พบรายการชำระเงิน', 404);

    const nextStatus = body.status ?? payment.status;
    const creditDelta =
      payment.status !== 'PAID' && nextStatus === 'PAID'
        ? payment.amountBaht
        : payment.status === 'PAID' && nextStatus !== 'PAID'
          ? -payment.amountBaht
          : 0;

    const updated = await prisma.$transaction(async (tx) => {
      if (creditDelta !== 0) {
        await tx.user.update({
          where: { id: payment.userId },
          data: { credit: { increment: creditDelta } },
        });
      }

      return tx.payment.update({
        where: { id: payment.id },
        data: {
          ...(body.status ? { status: body.status } : {}),
          ...(typeof body.reference !== 'undefined' ? { reference: body.reference || null } : {}),
        },
        include: { user: { select: paymentUserSelect } },
      });
    });

    return ok(res, updated, 'บันทึกรายการชำระเงินสำเร็จ');
  }),
);

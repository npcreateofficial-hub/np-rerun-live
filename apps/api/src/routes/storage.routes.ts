import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { AppError, asyncHandler, ok } from '../http';
import { requireAuth, type AuthedRequest } from '../auth';
import { effectivePackage, getUsage, getUserWithPackage, limitsFromPackage, maxVideoFileSizeBytes, videoStorageCapacityBytes } from '../limits';

export const storageRouter = Router();

storageRouter.use(requireAuth);

storageRouter.get(
  '/usage',
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await getUserWithPackage(req.userId!);
    const limits = limitsFromPackage(effectivePackage(user));
    const usage = await getUsage(req.userId!);

    const [fileCount, folderCount] = await Promise.all([
      prisma.storageFile.count({ where: { userId: req.userId } }),
      prisma.storageFolder.count({ where: { userId: req.userId } }),
    ]);

    const totalBytes = videoStorageCapacityBytes(limits);
    const usedBytes = usage.storageBytes;
    const percent = totalBytes > 0 ? Math.min(100, Math.round((usedBytes / totalBytes) * 100)) : 0;

    return ok(res, {
      usedBytes,
      usedGb: Number((usedBytes / (1024 * 1024 * 1024)).toFixed(4)),
      totalGb: null,
      totalBytes: null,
      percent,
      remainingBytes: null,
      maxFileSizeGb: Number((maxVideoFileSizeBytes(limits) / (1024 * 1024 * 1024)).toFixed(0)),
      maxFileSizeBytes: maxVideoFileSizeBytes(limits),
      fileCount,
      folderCount,
    });
  }),
);

storageRouter.get(
  '/folders',
  asyncHandler(async (req: AuthedRequest, res) => {
    const folders = await prisma.storageFolder.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, folders);
  }),
);

const folderSchema = z.object({ name: z.string().min(1, 'กรุณากรอกชื่อโฟลเดอร์'), parentId: z.string().nullish() });

storageRouter.post(
  '/folders',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = folderSchema.parse(req.body);
    const folder = await prisma.storageFolder.create({
      data: { userId: req.userId!, name: body.name, parentId: body.parentId ?? null },
    });
    return ok(res, folder, 'สร้างโฟลเดอร์สำเร็จ', 201);
  }),
);

storageRouter.get(
  '/files',
  asyncHandler(async (req: AuthedRequest, res) => {
    const files = await prisma.storageFile.findMany({
      where: { userId: req.userId },
      include: { folder: true },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, files);
  }),
);

const fileSchema = z.object({
  name: z.string().min(1),
  sizeBytes: z.coerce.number().int().min(0),
  mimeType: z.string().optional(),
  folderId: z.string().nullish(),
});

storageRouter.post(
  '/files',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = fileSchema.parse(req.body);

    const user = await getUserWithPackage(req.userId!);
    const limits = limitsFromPackage(effectivePackage(user));
    const usage = await getUsage(req.userId!);
    if (usage.videos >= limits.videos) {
      throw new AppError('เพิ่มวิดีโอครบโควตาแพ็กเกจแล้ว', 403);
    }

    const file = await prisma.storageFile.create({
      data: {
        userId: req.userId!,
        name: body.name,
        sizeBytes: body.sizeBytes,
        mimeType: body.mimeType ?? null,
        folderId: body.folderId ?? null,
      },
    });
    return ok(res, file, 'เพิ่มไฟล์สำเร็จ', 201);
  }),
);

storageRouter.delete(
  '/files/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const file = await prisma.storageFile.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!file) throw new AppError('ไม่พบไฟล์', 404);
    await prisma.storageFile.delete({ where: { id: file.id } });
    return ok(res, { success: true }, 'ลบไฟล์สำเร็จ');
  }),
);

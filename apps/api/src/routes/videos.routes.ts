import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Router, type NextFunction, type Response } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { prisma } from '../prisma';
import { AppError, asyncHandler, ok } from '../http';
import { requireAuth, type AuthedRequest } from '../auth';
import { BYTES_PER_GB, canCreateWithinLimit, effectivePackage, getUsage, getUserWithPackage, limitsFromPackage, maxVideoFileSizeBytes, remainingForLimit, type Limits } from '../limits';
import { createUploadVideo, resolveUploadPath } from '../uploads';
import { parseShopeeBasketItems, shopee } from '../shopee';

export const videosRouter = Router();

videosRouter.use(requireAuth);

type VideoUploadRequest = AuthedRequest & {
  videoUploadLimit?: {
    limits: Limits;
    maxFileBytes: number;
  };
};

async function ownedVideo(userId: string, id: string) {
  const video = await prisma.video.findFirst({ where: { id, userId }, include: { liveChannel: true } });
  if (!video) throw new AppError('ไม่พบวิดีโอ', 404);
  return video;
}

async function assertVideoQuota(userId: string) {
  const user = await getUserWithPackage(userId);
  const limits = limitsFromPackage(effectivePackage(user));
  const usage = await getUsage(userId);
  if (!canCreateWithinLimit(limits.videos, usage.videos)) throw new AppError('จำนวนวิดีโอเต็มโควตาแพ็กเกจแล้ว', 403);
  return { limits, usage };
}

function formatGb(bytes: number) {
  return (bytes / BYTES_PER_GB).toFixed(2);
}

async function assertRemoteVideoSizeWithinPackage(sourceUrl: string | null | undefined, limits: Limits) {
  if (!sourceUrl) return;
  const maxFileBytes = maxVideoFileSizeBytes(limits);
  if (maxFileBytes <= 0) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    let response = await fetch(sourceUrl, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
    let contentLength = response.headers.get('content-length');

    if (!response.ok || !contentLength) {
      response = await fetch(sourceUrl, {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        signal: controller.signal,
        redirect: 'follow',
      });
      const contentRange = response.headers.get('content-range');
      const rangeTotalBytes = contentRange?.match(/\/(\d+)$/)?.[1] ?? null;
      contentLength = rangeTotalBytes ?? (response.status === 206 ? null : response.headers.get('content-length'));
    }

    const sizeBytes = Number(contentLength);
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      throw new AppError('URL วิดีโอนี้ไม่แจ้งขนาดไฟล์ จึงไม่สามารถตรวจแพ็กเกจได้', 422);
    }

    if (sizeBytes > maxFileBytes) {
      throw new AppError(`วิดีโอจาก URL นี้ ${formatGb(sizeBytes)}GB เกินแพ็กเกจที่กำหนด ${limits.storageGb}GB/คลิป`, 413);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('ตรวจขนาดวิดีโอจาก URL ไม่สำเร็จ กรุณาใช้ URL ที่เข้าถึงได้และแจ้งขนาดไฟล์', 422);
  } finally {
    clearTimeout(timer);
  }
}

const prepareVideoUpload = asyncHandler(async (req: VideoUploadRequest, _res, next) => {
  req.setTimeout(config.uploadTimeoutMs);
  req.setTimeout(60 * 60 * 1000);
  const { limits } = await assertVideoQuota(req.userId!);
  const maxFileBytes = maxVideoFileSizeBytes(limits);

  const contentLength = Number(req.headers['content-length'] ?? 0);
  if (maxFileBytes > 0 && Number.isFinite(contentLength) && contentLength > maxFileBytes + 5 * 1024 * 1024) {
    throw new AppError(`ไฟล์นี้เกินแพ็กเกจที่กำหนด ${limits.storageGb}GB/คลิป`, 413);
  }

  req.videoUploadLimit = { limits, maxFileBytes };
  next();
});

function uploadVideoForPackage(req: VideoUploadRequest, res: Response, next: NextFunction) {
  const maxFileBytes = req.videoUploadLimit?.maxFileBytes ?? 1;
  const maxFileSizeGb = req.videoUploadLimit?.limits.storageGb ?? formatGb(maxFileBytes);
  createUploadVideo(maxFileBytes).single('file')(req, res, (error: unknown) => {
    if (!error) return next();
    if (typeof error === 'object' && error && 'code' in error && (error as { code?: string }).code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(`ไฟล์นี้เกินแพ็กเกจที่กำหนด ${maxFileSizeGb}GB/คลิป`, 413));
    }
    return next(error);
  });
}

const chunkUploadInitSchema = z.object({
  title: z.string().min(1, 'กรุณากรอกชื่อวิดีโอ'),
  fileName: z.string().min(1, 'ไม่พบชื่อไฟล์'),
  fileSize: z.number().int().positive('ขนาดไฟล์ไม่ถูกต้อง'),
  chunkSize: z.number().int().positive('ขนาด chunk ไม่ถูกต้อง'),
  totalChunks: z.number().int().positive('จำนวน chunk ไม่ถูกต้อง'),
  mimeType: z.string().optional(),
  liveChannelId: z.string().nullish(),
});

type ChunkUploadManifest = z.infer<typeof chunkUploadInitSchema> & {
  uploadId: string;
  userId: string;
  originalExt: string;
  createdAt: string;
  receivedChunks: number[];
  receivedBytes: number;
};

function chunkUploadRoot() {
  return path.join(config.uploadDir, 'tmp-chunks');
}

function chunkUploadDir(uploadId: string) {
  return path.join(chunkUploadRoot(), uploadId);
}

function chunkManifestPath(uploadId: string) {
  return path.join(chunkUploadDir(uploadId), 'manifest.json');
}

function assertSafeUploadId(uploadId: string) {
  if (!/^[a-f0-9-]{36}$/i.test(uploadId)) throw new AppError('uploadId ไม่ถูกต้อง', 400);
}

async function readChunkManifest(uploadId: string, userId: string): Promise<ChunkUploadManifest> {
  assertSafeUploadId(uploadId);
  try {
    const raw = await fs.promises.readFile(chunkManifestPath(uploadId), 'utf8');
    const manifest = JSON.parse(raw) as ChunkUploadManifest;
    if (manifest.userId !== userId) throw new AppError('ไม่พบงานอัปโหลดนี้', 404);
    return manifest;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('ไม่พบงานอัปโหลดนี้', 404);
  }
}

async function writeChunkManifest(manifest: ChunkUploadManifest) {
  await fs.promises.mkdir(chunkUploadDir(manifest.uploadId), { recursive: true });
  await fs.promises.writeFile(chunkManifestPath(manifest.uploadId), JSON.stringify(manifest, null, 2));
}

function chunkPath(uploadId: string, index: number) {
  return path.join(chunkUploadDir(uploadId), `chunk-${String(index).padStart(6, '0')}.part`);
}

function assertVideoExtension(fileName: string) {
  const ext = path.extname(fileName).toLowerCase();
  if (!['.mp4', '.m4v', '.mov', '.webm'].includes(ext)) {
    throw new AppError('รองรับเฉพาะไฟล์วิดีโอ MP4, M4V, MOV หรือ WEBM', 422);
  }
  return ext;
}
function assertSafeSourceUrl(sourceUrl?: string | null) {
  if (!sourceUrl) return;
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw new AppError('URL วิดีโอไม่ถูกต้อง', 422);
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new AppError('URL วิดีโอต้องเป็น http หรือ https เท่านั้น', 422);
  }

  const host = url.hostname.toLowerCase();
  const blockedHosts = ['localhost', '127.0.0.1', '::1', '0.0.0.0'];
  const privateHostPattern = /^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/;
  if (blockedHosts.includes(host) || privateHostPattern.test(host)) {
    throw new AppError('ไม่อนุญาตให้ใช้ URL ภายในระบบหรือเครือข่ายส่วนตัว', 422);
  }
}

videosRouter.get(
  '/usage',
  asyncHandler(async (req: AuthedRequest, res) => {
    const user = await getUserWithPackage(req.userId!);
    const limits = limitsFromPackage(effectivePackage(user));
    const currentVideos = await prisma.video.count({ where: { userId: req.userId! } });
    const remaining = remainingForLimit(limits.videos, currentVideos);
    const maxFileSizeBytes = maxVideoFileSizeBytes(limits);
    return ok(res, {
      used: currentVideos,
      limit: limits.videos,
      remaining,
      canCreate: canCreateWithinLimit(limits.videos, currentVideos),
      maxFileSizeGb: limits.storageGb,
      maxFileSizeBytes,
    });
  }),
);

videosRouter.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const items = await prisma.video.findMany({
      where: { userId: req.userId },
      include: { liveChannel: { select: { id: true, name: true, isOnline: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return ok(res, items);
  }),
);

videosRouter.post(
  '/uploads/init',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = chunkUploadInitSchema.parse(req.body);
    const { limits } = await assertVideoQuota(req.userId!);
    const maxFileBytes = maxVideoFileSizeBytes(limits);
    if (maxFileBytes > 0 && body.fileSize > maxFileBytes) {
      throw new AppError(`ไฟล์นี้ ${formatGb(body.fileSize)}GB เกินแพ็กเกจที่กำหนด ${limits.storageGb}GB/คลิป`, 413);
    }
    if (body.totalChunks !== Math.ceil(body.fileSize / body.chunkSize)) {
      throw new AppError('จำนวน chunk ไม่ตรงกับขนาดไฟล์', 422);
    }

    const uploadId = crypto.randomUUID();
    const manifest: ChunkUploadManifest = {
      ...body,
      uploadId,
      userId: req.userId!,
      originalExt: assertVideoExtension(body.fileName),
      createdAt: new Date().toISOString(),
      receivedChunks: [],
      receivedBytes: 0,
    };
    await writeChunkManifest(manifest);

    return ok(res, {
      uploadId,
      receivedChunks: manifest.receivedChunks,
      chunkSize: body.chunkSize,
      totalChunks: body.totalChunks,
    }, 'เริ่มอัปโหลดวิดีโอแล้ว', 201);
  }),
);

videosRouter.get(
  '/uploads/:uploadId',
  asyncHandler(async (req: AuthedRequest, res) => {
    const manifest = await readChunkManifest(req.params.uploadId, req.userId!);
    return ok(res, {
      uploadId: manifest.uploadId,
      receivedChunks: manifest.receivedChunks,
      receivedBytes: manifest.receivedBytes,
      fileSize: manifest.fileSize,
      totalChunks: manifest.totalChunks,
    });
  }),
);

videosRouter.post(
  '/uploads/:uploadId/chunks/:index',
  asyncHandler(async (req: AuthedRequest, res) => {
    req.setTimeout(config.uploadTimeoutMs);
    const manifest = await readChunkManifest(req.params.uploadId, req.userId!);
    const index = Number(req.params.index);
    if (!Number.isInteger(index) || index < 0 || index >= manifest.totalChunks) {
      throw new AppError('หมายเลข chunk ไม่ถูกต้อง', 422);
    }

    const expectedStart = index * manifest.chunkSize;
    const expectedSize = Math.min(manifest.chunkSize, manifest.fileSize - expectedStart);
    const contentLength = Number(req.headers['content-length'] ?? 0);
    if (!Number.isFinite(contentLength) || contentLength <= 0) throw new AppError('ไม่พบข้อมูล chunk', 400);
    if (contentLength !== expectedSize) throw new AppError('ขนาด chunk ไม่ถูกต้อง', 422);

    const targetPath = chunkPath(manifest.uploadId, index);
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    await pipeline(req, fs.createWriteStream(targetPath));

    const stat = await fs.promises.stat(targetPath);
    if (stat.size !== expectedSize) throw new AppError('บันทึก chunk ไม่ครบ', 500);

    const received = new Set(manifest.receivedChunks);
    received.add(index);
    manifest.receivedChunks = Array.from(received).sort((a, b) => a - b);
    manifest.receivedBytes = manifest.receivedChunks.reduce((total, item) => {
      const start = item * manifest.chunkSize;
      return total + Math.min(manifest.chunkSize, manifest.fileSize - start);
    }, 0);
    await writeChunkManifest(manifest);

    return ok(res, {
      uploadId: manifest.uploadId,
      receivedChunks: manifest.receivedChunks,
      receivedBytes: manifest.receivedBytes,
      fileSize: manifest.fileSize,
      done: manifest.receivedChunks.length === manifest.totalChunks,
    });
  }),
);

videosRouter.post(
  '/uploads/:uploadId/complete',
  asyncHandler(async (req: AuthedRequest, res) => {
    const manifest = await readChunkManifest(req.params.uploadId, req.userId!);
    if (manifest.receivedChunks.length !== manifest.totalChunks) {
      throw new AppError('ยังอัปโหลด chunk ไม่ครบ', 409, {
        receivedChunks: manifest.receivedChunks,
        totalChunks: manifest.totalChunks,
      });
    }

    const outputName = `${crypto.randomBytes(16).toString('hex')}${manifest.originalExt}`;
    const outputPath = resolveUploadPath(outputName);
    await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

    const output = fs.createWriteStream(outputPath);
    try {
      for (let index = 0; index < manifest.totalChunks; index += 1) {
        const partPath = chunkPath(manifest.uploadId, index);
        await pipeline(fs.createReadStream(partPath), output, { end: false });
      }
    } finally {
      await new Promise<void>((resolve, reject) => {
        output.once('error', reject);
        output.end(() => resolve());
      });
    }

    const stat = await fs.promises.stat(outputPath);
    if (stat.size !== manifest.fileSize) {
      await fs.promises.rm(outputPath, { force: true });
      throw new AppError('รวมไฟล์วิดีโอไม่ครบ กรุณาอัปโหลดใหม่', 500);
    }

    const video = await prisma.video.create({
      data: {
        userId: req.userId!,
        title: manifest.title,
        liveChannelId: manifest.liveChannelId || null,
        status: 'READY',
        fileKey: outputName,
        sourceUrl: null,
        sizeMb: Number((stat.size / (1024 * 1024)).toFixed(2)),
      },
    });

    await fs.promises.rm(chunkUploadDir(manifest.uploadId), { recursive: true, force: true });
    return ok(res, video, 'อัปโหลดวิดีโอสำเร็จ', 201);
  }),
);
// multipart upload — field name "file"
videosRouter.post(
  '/upload',
  prepareVideoUpload,
  uploadVideoForPackage,
  asyncHandler(async (req: VideoUploadRequest, res) => {
    const file = req.file;
    if (!file) throw new AppError('ไม่พบไฟล์วิดีโอ', 400);

    try {
      const limits = req.videoUploadLimit?.limits ?? (await assertVideoQuota(req.userId!)).limits;
      const maxFileBytes = req.videoUploadLimit?.maxFileBytes ?? maxVideoFileSizeBytes(limits);
      if (maxFileBytes > 0 && file.size > maxFileBytes) {
        const fileGb = file.size / BYTES_PER_GB;
        throw new AppError(`ไฟล์นี้ ${fileGb.toFixed(2)}GB เกินแพ็กเกจที่กำหนด ${limits.storageGb}GB/คลิป`, 413);
      }
    } catch (err) {
      fs.unlink(file.path, () => undefined);
      throw err;
    }

    const title = (req.body?.title as string | undefined)?.trim() || file.originalname.replace(/\.[^.]+$/, '');
    const liveChannelId = (req.body?.liveChannelId as string | undefined) || null;

    const video = await prisma.video.create({
      data: {
        userId: req.userId!,
        title,
        liveChannelId,
        status: 'READY', // uploaded file is ready to rerun
        fileKey: path.basename(file.path),
        sourceUrl: null,
        sizeMb: Number((file.size / (1024 * 1024)).toFixed(2)),
      },
    });

    return ok(res, video, 'อัปโหลดวิดีโอสำเร็จ', 201);
  }),
);

const createSchema = z.object({
  title: z.string().min(1, 'กรุณากรอกชื่อวิดีโอ'),
  sourceUrl: z.string().url('URL ไม่ถูกต้อง').nullish(),
  liveChannelId: z.string().nullish(),
});

const importShopeeProductVideoSchema = z.object({
  liveChannelId: z.string().min(1, 'กรุณาเลือกบัญชี Shopee'),
  productUrl: z.string().nullish(),
  shopId: z.union([z.string(), z.number()]).nullish(),
  itemId: z.union([z.string(), z.number()]).nullish(),
  title: z.string().nullish(),
});

videosRouter.post(
  '/import/shopee-product',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = importShopeeProductVideoSchema.parse(req.body);
    await assertVideoQuota(req.userId!);

    const channel = await prisma.liveChannel.findFirst({ where: { id: body.liveChannelId, userId: req.userId } });
    if (!channel) throw new AppError('ไม่พบช่องไลฟ์ที่เลือก', 404);
    if (channel.platform !== 'SHOPEE') throw new AppError('บัญชีนี้ไม่ใช่ Shopee', 400);
    if (channel.cookieValid === false) throw new AppError('คุกกี้ของบัญชีนี้ใช้ไม่ได้ กรุณาเชื่อมบัญชีใหม่', 400);
    if (!channel.cookie) throw new AppError('บัญชีนี้ไม่มีคุกกี้ Shopee', 400);

    const productUrl = body.productUrl?.trim() || '';
    const parsedItems = productUrl ? parseShopeeBasketItems(productUrl, null) : [];
    const directShopId = Number(body.shopId);
    const directItemId = Number(body.itemId);
    const directItems = Number.isSafeInteger(directShopId) && Number.isSafeInteger(directItemId) && directShopId > 0 && directItemId > 0
      ? [{ shop_id: directShopId, item_id: directItemId, url: productUrl || `https://shopee.co.th/product/${directShopId}/${directItemId}` }]
      : [];
    const items = directItems.length ? directItems : parsedItems;
    const links = productUrl ? [productUrl] : [];
    if (!items.length && !links.length) throw new AppError('กรุณาส่งลิงก์สินค้า Shopee หรือ shopId/itemId', 400);

    const result = await shopee.productDetails(channel.cookie, channel.liveSessionId, items, links);
    const product = result.items.find((item) => item.videoUrl) ?? result.items[0];
    if (!product) throw new AppError('Shopee ไม่คืนข้อมูลสินค้านี้', 502);
    if (product.error) throw new AppError(product.error, 502, product.raw ?? undefined);
    if (!product.videoUrl) throw new AppError('สินค้านี้ไม่มีวิดีโอ หรือ Shopee ไม่คืน URL วิดีโอใน API นี้', 404, product.raw ?? undefined);

    assertSafeSourceUrl(product.videoUrl);
    const title = body.title?.trim() || product.name || `Shopee product ${product.itemId}`;
    const video = await prisma.video.create({
      data: {
        userId: req.userId!,
        title,
        sourceUrl: product.videoUrl,
        liveChannelId: channel.id,
        status: 'READY',
        durationSec: product.videoDurationSec,
      },
    });

    return ok(res, { video, product }, 'ดึงวิดีโอสินค้าจาก Shopee สำเร็จ', 201);
  }),
);

videosRouter.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = createSchema.parse(req.body);
    assertSafeSourceUrl(body.sourceUrl);
    const { limits } = await assertVideoQuota(req.userId!);
    await assertRemoteVideoSizeWithinPackage(body.sourceUrl, limits);

    const video = await prisma.video.create({
      data: {
        userId: req.userId!,
        title: body.title,
        sourceUrl: body.sourceUrl ?? null,
        liveChannelId: body.liveChannelId ?? null,
        status: body.sourceUrl ? 'READY' : 'PENDING',
      },
    });

    return ok(res, video, 'เพิ่มวิดีโอสำเร็จ', 201);
  }),
);

videosRouter.get(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    return ok(res, await ownedVideo(req.userId!, req.params.id));
  }),
);

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  sourceUrl: z.string().url().nullish(),
  liveChannelId: z.string().nullish(),
});

videosRouter.patch(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const video = await ownedVideo(req.userId!, req.params.id);
    const body = updateSchema.parse(req.body);
    assertSafeSourceUrl(body.sourceUrl);
    if (body.sourceUrl) {
      const user = await getUserWithPackage(req.userId!);
      const limits = limitsFromPackage(effectivePackage(user));
      await assertRemoteVideoSizeWithinPackage(body.sourceUrl, limits);
    }

    if (body.liveChannelId) {
      const channel = await prisma.liveChannel.findFirst({ where: { id: body.liveChannelId, userId: req.userId } });
      if (!channel) throw new AppError('ไม่พบช่องไลฟ์ที่เลือก', 400);
    }

    const updated = await prisma.video.update({
      where: { id: video.id },
      data: {
        title: body.title,
        sourceUrl: body.sourceUrl === undefined ? undefined : body.sourceUrl,
        liveChannelId: body.liveChannelId === undefined ? undefined : body.liveChannelId,
      },
    });
    return ok(res, updated, 'บันทึกวิดีโอสำเร็จ');
  }),
);

const statusSchema = z.object({ status: z.enum(['PENDING', 'PROCESSING', 'READY', 'FAILED']) });

videosRouter.patch(
  '/:id/status',
  asyncHandler(async (req: AuthedRequest, res) => {
    const video = await ownedVideo(req.userId!, req.params.id);
    const { status } = statusSchema.parse(req.body);
    const updated = await prisma.video.update({ where: { id: video.id }, data: { status } });
    return ok(res, updated, 'อัปเดตสถานะวิดีโอสำเร็จ');
  }),
);

// Simple "convert" — marks the video READY (placeholder for a real transcode job).
videosRouter.post(
  '/:id/convert',
  asyncHandler(async (req: AuthedRequest, res) => {
    const video = await ownedVideo(req.userId!, req.params.id);
    const updated = await prisma.video.update({ where: { id: video.id }, data: { status: 'READY' } });
    return ok(res, updated, 'แปลงวิดีโอสำเร็จ');
  }),
);

videosRouter.delete(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const video = await ownedVideo(req.userId!, req.params.id);

    const active = await prisma.rerun.findFirst({
      where: { videoId: video.id, status: { in: ['STARTING', 'LIVE', 'STOPPING'] } },
    });
    if (active) throw new AppError('วิดีโอนี้กำลังถูกใช้รีรันอยู่ กรุณาหยุดไลฟ์ก่อน', 409);

    if (video.fileKey) {
      const abs = resolveUploadPath(video.fileKey);
      fs.unlink(abs, () => undefined);
    }
    await prisma.rerun.deleteMany({ where: { videoId: video.id } });
    await prisma.video.delete({ where: { id: video.id } });
    return ok(res, { deleted: true }, 'ลบวิดีโอสำเร็จ');
  }),
);


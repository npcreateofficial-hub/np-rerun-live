import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { config } from './config';

const allowedVideoExtensions = new Set(['.mp4', '.m4v', '.mov', '.webm']);
const allowedVideoMimeTypes = new Set(['video/mp4', 'video/x-m4v', 'video/quicktime', 'video/webm']);
const allowedImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const allowedImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function ensureUploadDir() {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

export function resolveUploadPath(fileKey: string) {
  const resolved = path.resolve(config.uploadDir, fileKey);
  const root = `${path.resolve(config.uploadDir)}${path.sep}`;
  if (!resolved.startsWith(root)) {
    throw new Error('Invalid upload path');
  }
  return resolved;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDir();
    cb(null, config.uploadDir);
  },
  filename: (_req, file, cb) => {
    const requestedExt = path.extname(file.originalname).toLowerCase();
    const ext = allowedVideoExtensions.has(requestedExt) ? requestedExt : '.mp4';
    const base = crypto.randomBytes(16).toString('hex');
    cb(null, `${base}${ext}`);
  },
});

function fileFilter(_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedVideoExtensions.has(ext) && allowedVideoMimeTypes.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('รองรับเฉพาะไฟล์วิดีโอ MP4, M4V, MOV หรือ WEBM'));
  }
}

export function createUploadVideo(maxFileSizeBytes: number) {
  const limits = maxFileSizeBytes > 0 ? { fileSize: Math.floor(maxFileSizeBytes) } : undefined;
  return multer({
    storage,
    limits,
    fileFilter,
  });
}

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDir();
    cb(null, config.uploadDir);
  },
  filename: (_req, file, cb) => {
    const requestedExt = path.extname(file.originalname).toLowerCase();
    const ext = allowedImageExtensions.has(requestedExt) ? requestedExt : '.jpg';
    const base = crypto.randomBytes(16).toString('hex');
    cb(null, `slip-${base}${ext}`);
  },
});

function imageFileFilter(_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedImageExtensions.has(ext) && allowedImageMimeTypes.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('รองรับเฉพาะรูป JPG, PNG หรือ WEBP'));
  }
}

export function createUploadImage(maxFileSizeBytes = 10 * 1024 * 1024) {
  return multer({
    storage: imageStorage,
    limits: { fileSize: Math.max(1, Math.floor(maxFileSizeBytes)) },
    fileFilter: imageFileFilter,
  });
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = ON;`);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Package" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "description" TEXT,
      "priceBaht" REAL NOT NULL DEFAULT 0,
      "durationDays" INTEGER NOT NULL DEFAULT 30,
      "maxAccounts" INTEGER NOT NULL DEFAULT 1,
      "maxLiveChannels" INTEGER NOT NULL DEFAULT 1,
      "maxVideos" INTEGER NOT NULL DEFAULT 5,
      "storageGb" INTEGER NOT NULL DEFAULT 1,
      "maxDevices" INTEGER NOT NULL DEFAULT 1,
      "maxProxies" INTEGER NOT NULL DEFAULT 1,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserDevice" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "deviceId" TEXT NOT NULL,
      "name" TEXT,
      "firstSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "UserDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL,
      "username" TEXT,
      "displayName" TEXT,
      "phone" TEXT,
      "lineId" TEXT,
      "marketingStatus" TEXT NOT NULL DEFAULT 'NEW',
      "lastContactedAt" DATETIME,
      "adminNote" TEXT,
      "passwordHash" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'USER',
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "credit" REAL NOT NULL DEFAULT 0,
      "packageId" TEXT,
      "packageStartedAt" DATETIME,
      "packageExpiresAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "User_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RefreshToken" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "token" TEXT NOT NULL,
      "expiresAt" DATETIME NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Proxy" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "host" TEXT NOT NULL,
      "port" INTEGER NOT NULL,
      "username" TEXT,
      "password" TEXT,
      "note" TEXT,
      "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
      "checkedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Proxy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "LiveChannel" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "isOnline" BOOLEAN NOT NULL DEFAULT false,
      "proxyId" TEXT,
      "platform" TEXT NOT NULL DEFAULT 'SHOPEE',
      "accountName" TEXT,
      "shopId" TEXT,
      "platformUid" TEXT,
      "avatar" TEXT,
      "status" TEXT,
      "cookie" TEXT,
      "cookieValid" BOOLEAN,
      "rtmpUrl" TEXT,
      "streamKey" TEXT,
      "coverImageUrl" TEXT,
      "liveSessionId" TEXT,
      "basketLinks" TEXT,
      "basketItemsJson" TEXT,
      "caption" TEXT,
      "description" TEXT,
      "autoLive" BOOLEAN DEFAULT false,
      "liveDurationMinutes" INTEGER,
      "restartDelayMinutes" INTEGER,
      "scheduledStartAt" DATETIME,
      "scheduledStopAt" DATETIME,
      "lastCheckedAt" DATETIME,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "LiveChannel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "LiveChannel_proxyId_fkey" FOREIGN KEY ("proxyId") REFERENCES "Proxy" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Video" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "liveChannelId" TEXT,
      "title" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "sourceUrl" TEXT,
      "fileKey" TEXT,
      "durationSec" INTEGER,
      "sizeMb" REAL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Video_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Video_liveChannelId_fkey" FOREIGN KEY ("liveChannelId") REFERENCES "LiveChannel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StorageFolder" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "parentId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "StorageFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StorageFile" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "sizeBytes" INTEGER NOT NULL DEFAULT 0,
      "mimeType" TEXT,
      "url" TEXT,
      "folderId" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "StorageFile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "StorageFile_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "StorageFolder" ("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Rerun" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "liveChannelId" TEXT NOT NULL,
      "videoId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'STARTING',
      "rtmpUrl" TEXT,
      "streamKey" TEXT,
      "ffmpegPid" INTEGER,
      "startedAt" DATETIME,
      "stoppedAt" DATETIME,
      "durationSec" INTEGER,
      "errorMessage" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Rerun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Rerun_liveChannelId_fkey" FOREIGN KEY ("liveChannelId") REFERENCES "LiveChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Rerun_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Payment" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "amountBaht" REAL NOT NULL,
      "method" TEXT,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "reference" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Notification" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT,
      "title" TEXT NOT NULL,
      "message" TEXT NOT NULL,
      "imageUrl" TEXT,
      "styleJson" TEXT,
      "ctaLabel" TEXT,
      "ctaUrl" TEXT,
      "type" TEXT NOT NULL DEFAULT 'INFO',
      "status" TEXT NOT NULL DEFAULT 'SENT',
      "isRead" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    );
  `);

  const packageColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("Package");`);
  if (!packageColumns.some((column) => column.name === 'maxDevices')) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Package" ADD COLUMN "maxDevices" INTEGER NOT NULL DEFAULT 1;`);
  }

  const indexes = [
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "RefreshToken_token_key" ON "RefreshToken"("token");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Package_code_key" ON "Package"("code");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "UserDevice_userId_deviceId_key" ON "UserDevice"("userId", "deviceId");`,
    `CREATE INDEX IF NOT EXISTS "UserDevice_userId_idx" ON "UserDevice"("userId");`,
    `CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx" ON "RefreshToken"("userId");`,
    `CREATE INDEX IF NOT EXISTS "LiveChannel_userId_idx" ON "LiveChannel"("userId");`,
    `CREATE INDEX IF NOT EXISTS "Video_userId_idx" ON "Video"("userId");`,
    `CREATE INDEX IF NOT EXISTS "StorageFolder_userId_idx" ON "StorageFolder"("userId");`,
    `CREATE INDEX IF NOT EXISTS "StorageFile_userId_idx" ON "StorageFile"("userId");`,
    `CREATE INDEX IF NOT EXISTS "Proxy_userId_idx" ON "Proxy"("userId");`,
    `CREATE INDEX IF NOT EXISTS "Rerun_userId_idx" ON "Rerun"("userId");`,
    `CREATE INDEX IF NOT EXISTS "Rerun_liveChannelId_idx" ON "Rerun"("liveChannelId");`,
    `CREATE INDEX IF NOT EXISTS "Payment_userId_idx" ON "Payment"("userId");`,
    `CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");`,
    `CREATE INDEX IF NOT EXISTS "Notification_status_idx" ON "Notification"("status");`,
  ];

  for (const indexSql of indexes) {
    await prisma.$executeRawUnsafe(indexSql);
  }

  console.log('SQLite schema is ready.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { revealSecret } = require('./dist/secrets.js');

const prisma = new PrismaClient();

function hasCookie(cookie, key) {
  return new RegExp(`(?:^|;\\s*)${key}=`, 'i').test(String(cookie || ''));
}

try {
  const channels = await prisma.liveChannel.findMany({
    where: { platform: 'SHOPEE' },
    select: { id: true, accountName: true, name: true, shopId: true, platformUid: true, cookie: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
  });
  for (const channel of channels) {
    const cookie = revealSecret(channel.cookie);
    console.log(JSON.stringify({
      id: channel.id,
      accountName: channel.accountName,
      name: channel.name,
      shopId: channel.shopId,
      platformUid: channel.platformUid,
      cookiePresent: Boolean(cookie),
      hasSPC_CDS: hasCookie(cookie, 'SPC_CDS'),
      hasSPC_EC: hasCookie(cookie, 'SPC_EC'),
      hasSPC_ST: hasCookie(cookie, 'SPC_ST'),
      hasSPC_SC_SESSION: hasCookie(cookie, 'SPC_SC_SESSION'),
      updatedAt: channel.updatedAt,
    }));
  }
} finally {
  await prisma.$disconnect();
}

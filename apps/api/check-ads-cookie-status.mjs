import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { revealSecret } = require('./dist/secrets.js');

const prisma = new PrismaClient();

function hasCookie(cookie, key) {
  return new RegExp(`(?:^|;\\s*)${key}=`, 'i').test(String(cookie || ''));
}

try {
  const adsAccounts = await prisma.adsAccount.findMany({
    select: {
      id: true,
      accountName: true,
      shopName: true,
      shopId: true,
      status: true,
      adsCookie: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  for (const account of adsAccounts) {
    const cookie = revealSecret(account.adsCookie);
    console.log(JSON.stringify({
      id: account.id,
      accountName: account.accountName,
      shopName: account.shopName,
      shopId: account.shopId,
      status: account.status,
      cookiePresent: Boolean(cookie),
      hasSPC_CDS: hasCookie(cookie, 'SPC_CDS'),
      hasSPC_EC: hasCookie(cookie, 'SPC_EC'),
      hasSPC_ST: hasCookie(cookie, 'SPC_ST'),
      hasSPC_SC_SESSION: hasCookie(cookie, 'SPC_SC_SESSION'),
      updatedAt: account.updatedAt,
    }));
  }
} finally {
  await prisma.$disconnect();
}

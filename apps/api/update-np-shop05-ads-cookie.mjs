import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { protectSecret } = require('./dist/secrets.js');

const prisma = new PrismaClient();
let input = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) input += chunk;

const cookie = input.trim();
if (!cookie) throw new Error('missing cookie stdin');

try {
  const account = await prisma.adsAccount.findFirst({
    where: { accountName: 'np_shop05' },
    orderBy: { updatedAt: 'desc' },
  });
  if (!account) throw new Error('np_shop05 ads account not found');
  await prisma.adsAccount.update({
    where: { id: account.id },
    data: {
      adsCookie: protectSecret(cookie),
      status: 'ACTIVE',
      checkedAt: new Date(),
    },
  });
  console.log(JSON.stringify({ updated: true, accountId: account.id, accountName: account.accountName }));
} finally {
  await prisma.$disconnect();
}

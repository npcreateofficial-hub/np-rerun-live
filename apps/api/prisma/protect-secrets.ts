import '../src/config';
import { prisma } from '../src/prisma';
import { isProtectedSecret, protectSecret } from '../src/secrets';

async function main() {
  const channels = await prisma.liveChannel.findMany({
    select: { id: true, cookie: true },
  });

  let protectedCount = 0;
  for (const channel of channels) {
    if (!channel.cookie || isProtectedSecret(channel.cookie)) continue;
    const protectedCookie = protectSecret(channel.cookie);
    if (!protectedCookie) continue;
    await prisma.liveChannel.update({
      where: { id: channel.id },
      data: { cookie: protectedCookie },
    });
    protectedCount += 1;
  }

  console.log(`Protected Shopee cookies: ${protectedCount}/${channels.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

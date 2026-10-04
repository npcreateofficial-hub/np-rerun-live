const { PrismaClient } = require('@prisma/client');
const { shopee } = require('./dist/shopee');

const prisma = new PrismaClient();

async function main() {
  const channelId = process.env.CHANNEL_ID || 'cmuc6aoj0000knw01kygej894';
  const sessionId = process.env.SESSION_ID || '27631686';
  const message = process.env.MESSAGE || 'ทดสอบระบบตอบกลับค่ะ';
  const channel = await prisma.liveChannel.findUnique({ where: { id: channelId } });
  if (!channel?.cookie) throw new Error(`No cookie for channel ${channelId}`);
  const result = await shopee.sendLiveComment(channel.cookie, sessionId, message);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

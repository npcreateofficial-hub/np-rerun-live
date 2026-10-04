const { PrismaClient } = require('@prisma/client');
const { shopee } = require('./dist/shopee');

const prisma = new PrismaClient();

async function main() {
  const channel = await prisma.liveChannel.findUnique({
    where: { id: 'cmuj821wu00knqz010syp6pib' },
  });
  if (!channel) throw new Error('channel not found');
  const link = process.argv[2] || 'https://shopee.co.th/product/250362237/46810364281';
  const result = await shopee.productDetails(channel.cookie, channel.liveSessionId || null, [], [link]);
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error((error && (error.stack || error.message)) || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

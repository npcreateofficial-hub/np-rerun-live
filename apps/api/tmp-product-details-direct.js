const { PrismaClient } = require('@prisma/client');
const { shopee, parseShopeeBasketItems } = require('./dist/shopee');

const prisma = new PrismaClient();

function describeError(error) {
  if (!error) return error;
  const own = {};
  for (const key of Object.getOwnPropertyNames(error)) own[key] = error[key];
  return {
    type: error.constructor && error.constructor.name,
    message: error.message,
    stack: error.stack,
    own,
    string: String(error),
  };
}

async function main() {
  const channel = await prisma.liveChannel.findUnique({
    where: { id: 'cmuj821wu00knqz010syp6pib' },
  });
  if (!channel) throw new Error('channel not found');
  const links = [
    'https://s.shopee.co.th/1LFrP46TI6',
    'https://s.shopee.co.th/1VyrbN5px9',
    'https://s.shopee.co.th/112b0S7jy4',
    'https://s.shopee.co.th/1BM1C176d7',
    'https://s.shopee.co.th/gPkbq90e2',
  ];
  const items = links.flatMap((link) => parseShopeeBasketItems(link, null));
  try {
    const result = await shopee.productDetails(channel.cookie, channel.liveSessionId || null, items, links);
    console.log(JSON.stringify({
      ok: true,
      sessionId: result.sessionId,
      count: result.items.length,
      first: result.items[0],
      bytes: Buffer.byteLength(JSON.stringify(result)),
    }, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ ok: false, error: describeError(error) }, null, 2));
  }
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ fatal: describeError(error) }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

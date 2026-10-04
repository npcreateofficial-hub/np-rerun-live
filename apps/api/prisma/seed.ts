import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PACKAGES = [
  {
    code: 'STARTER',
    name: 'Starter',
    category: 'STARTER',
    description: 'เริ่มต้นสำหรับทดลองรีรัน 1 ช่อง',
    priceBaht: 0,
    durationDays: 30,
    maxAccounts: 1,
    maxLiveChannels: 1,
    maxVideos: 5,
    storageGb: 1,
    maxProxies: 1,
    sortOrder: 1,
  },
  {
    code: 'PRO',
    name: 'Pro',
    category: 'PRO',
    description: 'สำหรับร้านที่รีรันหลายช่องพร้อมกัน',
    priceBaht: 590,
    durationDays: 30,
    maxAccounts: 5,
    maxLiveChannels: 5,
    maxVideos: 50,
    storageGb: 2,
    maxProxies: 5,
    sortOrder: 2,
  },
  {
    code: 'MAX',
    name: 'ProMax',
    category: 'PROMAX',
    description: 'สเกลเต็มสำหรับเอเจนซี่/ทีมขาย',
    priceBaht: 1590,
    durationDays: 30,
    maxAccounts: 20,
    maxLiveChannels: 20,
    maxVideos: 200,
    storageGb: 4,
    maxProxies: 20,
    sortOrder: 3,
  },
  {
    code: 'ULTRA_PRO',
    name: 'UltraPro',
    category: 'ULTRA_PRO',
    description: 'ระดับสูงสุดสำหรับทีมไลฟ์หลายแบรนด์',
    priceBaht: 2990,
    durationDays: 30,
    maxAccounts: 50,
    maxLiveChannels: 50,
    maxVideos: 500,
    storageGb: 8,
    maxProxies: 50,
    sortOrder: 4,
  },
];
async function main() {
  console.log('Seeding packages...');
  for (const pkg of PACKAGES) {
    await prisma.package.upsert({
      where: { code: pkg.code },
      update: pkg,
      create: pkg,
    });
  }

  const pro = await prisma.package.findUnique({ where: { code: 'PRO' } });

  const demoEmail = 'demo@nplive.local';
  const passwordHash = await bcrypt.hash('demo1234', 10);

  console.log('Seeding demo user (demo@nplive.local / demo1234)...');
  const demoUser = await prisma.user.upsert({
    where: { email: demoEmail },
    update: {
      credit: 0,
      packageId: pro?.id ?? null,
      packageStartedAt: new Date(),
      packageExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    create: {
      email: demoEmail,
      username: 'demo',
      displayName: 'Demo Seller',
      passwordHash,
      role: 'ADMIN',
      credit: 0,
      packageId: pro?.id ?? null,
      packageStartedAt: new Date(),
      packageExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('Seeding demo operating data...');
  const channels = [
    { id: 'demo-channel-rathabrand', name: 'rathabrand', session: '27461752', online: true, shopId: '4kq3ew3g', profile: 'ratha-020969 (31:00)' },
    { id: 'demo-channel-npshop04', name: 'np_shop04', session: '27461913', online: true, shopId: 'j422uv2u', profile: 'M-SRP-070969 (25:39)' },
    { id: 'demo-channel-npshop02', name: 'np_shop02', session: null, online: false, shopId: 'a80969', profile: 'Alinya-080969 (30:32)' },
  ];

  for (const channel of channels) {
    await prisma.liveChannel.upsert({
      where: { id: channel.id },
      update: {
        name: channel.name,
        accountName: channel.name,
        platform: 'SHOPEE',
        shopId: channel.shopId,
        platformUid: channel.profile,
        cookie: 'demo-cookie-placeholder',
        cookieValid: true,
        status: 'CONNECTED',
        isOnline: channel.online,
        liveSessionId: channel.session,
        coverImageUrl: '/banners/dashboard-update-feature.png',
        caption: `รีรันสินค้า ${channel.name}`,
        basketItemsJson: JSON.stringify([{ itemId: 1, title: 'สินค้าตัวอย่าง' }, { itemId: 2, title: 'โปรโมชันไลฟ์' }]),
      },
      create: {
        id: channel.id,
        userId: demoUser.id,
        name: channel.name,
        accountName: channel.name,
        platform: 'SHOPEE',
        shopId: channel.shopId,
        platformUid: channel.profile,
        cookie: 'demo-cookie-placeholder',
        cookieValid: true,
        status: 'CONNECTED',
        isOnline: channel.online,
        liveSessionId: channel.session,
        coverImageUrl: '/banners/dashboard-update-feature.png',
        caption: `รีรันสินค้า ${channel.name}`,
        basketItemsJson: JSON.stringify([{ itemId: 1, title: 'สินค้าตัวอย่าง' }, { itemId: 2, title: 'โปรโมชันไลฟ์' }]),
      },
    });
  }

  const videos = [
    { id: 'demo-video-hero', title: 'ไลฟ์รีรันสินค้าขายดี.mp4', channelId: 'demo-channel-rathabrand', sizeMb: 427.5, durationSec: 1750 },
    { id: 'demo-video-promo', title: 'โปรโมชันเที่ยงคืน.mp4', channelId: null, sizeMb: 318.2, durationSec: 1512 },
    { id: 'demo-video-sale', title: 'คลิปขายชุดหลัก.mp4', channelId: 'demo-channel-npshop04', sizeMb: 386.7, durationSec: 1830 },
  ];

  for (const video of videos) {
    await prisma.video.upsert({
      where: { id: video.id },
      update: {
        title: video.title,
        status: 'READY',
        liveChannelId: video.channelId,
        sizeMb: video.sizeMb,
        durationSec: video.durationSec,
        sourceUrl: `/streams/${video.id}.mp4`,
        fileKey: `${video.id}.mp4`,
      },
      create: {
        id: video.id,
        userId: demoUser.id,
        title: video.title,
        status: 'READY',
        liveChannelId: video.channelId,
        sizeMb: video.sizeMb,
        durationSec: video.durationSec,
        sourceUrl: `/streams/${video.id}.mp4`,
        fileKey: `${video.id}.mp4`,
      },
    });
  }

  const now = Date.now();
  const reruns = [
    { id: 'demo-rerun-rathabrand', channelId: 'demo-channel-rathabrand', videoId: 'demo-video-hero', title: 'rathabrand LIVE', startedAt: new Date(now - 19 * 60 * 1000 - 16 * 1000), durationSec: 1156 },
    { id: 'demo-rerun-npshop04', channelId: 'demo-channel-npshop04', videoId: 'demo-video-sale', title: 'np_shop04 LIVE', startedAt: new Date(now - 13 * 60 * 1000 - 41 * 1000), durationSec: 821 },
  ];

  for (const rerun of reruns) {
    await prisma.rerun.upsert({
      where: { id: rerun.id },
      update: {
        title: rerun.title,
        status: 'LIVE',
        startedAt: rerun.startedAt,
        durationSec: rerun.durationSec,
        stoppedAt: null,
        errorMessage: null,
      },
      create: {
        id: rerun.id,
        userId: demoUser.id,
        liveChannelId: rerun.channelId,
        videoId: rerun.videoId,
        title: rerun.title,
        status: 'LIVE',
        startedAt: rerun.startedAt,
        durationSec: rerun.durationSec,
      },
    });
  }

  const folder = await prisma.storageFolder.upsert({
    where: { id: 'demo-folder-main' },
    update: { name: 'วิดีโอพร้อมไลฟ์' },
    create: { id: 'demo-folder-main', userId: demoUser.id, name: 'วิดีโอพร้อมไลฟ์' },
  });

  for (const video of videos) {
    await prisma.storageFile.upsert({
      where: { id: `storage-${video.id}` },
      update: {
        name: video.title,
        sizeBytes: Math.round(video.sizeMb * 1024 * 1024),
        mimeType: 'video/mp4',
        folderId: folder.id,
        url: `/streams/${video.id}.mp4`,
      },
      create: {
        id: `storage-${video.id}`,
        userId: demoUser.id,
        name: video.title,
        sizeBytes: Math.round(video.sizeMb * 1024 * 1024),
        mimeType: 'video/mp4',
        folderId: folder.id,
        url: `/streams/${video.id}.mp4`,
      },
    });
  }

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());







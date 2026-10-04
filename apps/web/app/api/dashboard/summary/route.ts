import { apiData, channels, demoUser, sessions, syncUploadedVideos } from '../../_mock/store';

function hoursBetween(start?: string | null, stop?: string | null) {
  if (!start) return 0;
  const startTime = new Date(start).getTime();
  const stopTime = stop ? new Date(stop).getTime() : Date.now();
  if (Number.isNaN(startTime) || Number.isNaN(stopTime) || stopTime <= startTime) return 0;
  return (stopTime - startTime) / 3_600_000;
}

export async function GET() {
  const videos = syncUploadedVideos();
  const activeLives = channels.filter((item) => item.isOnline).length;
  const liveHours = sessions.reduce((sum, item) => sum + hoursBetween(item.startedAt, item.stoppedAt), 0);
  const completedSessions = Math.max(1, sessions.length || activeLives || 1);
  const baseSales = sessions.reduce((sum, item, index) => {
    const weight = item.status === 'LIVE' ? 1450 : item.status === 'ENDED' ? 980 : 0;
    return sum + weight + index * 120;
  }, 0);
  const demoSales = baseSales || activeLives * 1250;
  const orders = Math.round(demoSales / 390);
  const salesPerHour = liveHours > 0 ? demoSales / liveHours : activeLives > 0 ? 1250 : 0;
  const viewers = activeLives * 28 + Math.max(0, channels.length - activeLives) * 4;

  return apiData({
    user: demoUser,
    stats: {
      accounts: channels.length,
      proxies: 0,
      liveChannels: channels.length,
      videos: videos.length,
    },
    performance: {
      totalSales: demoSales,
      salesPerHour,
      orders,
      activeLives,
      liveHours: Number(liveHours.toFixed(1)),
      viewers,
      conversionRate: viewers > 0 ? Number(((orders / viewers) * 100).toFixed(1)) : 0,
      revenueTarget: 10000,
      orderTarget: 30,
      liveHourTarget: 24,
      trend: [
        { label: 'จันทร์', sales: Math.round(demoSales * 0.25), orders: Math.max(0, Math.round(orders * 0.22)), liveHours: Math.max(0, Number((liveHours * 0.18).toFixed(1))) },
        { label: 'อังคาร', sales: Math.round(demoSales * 0.38), orders: Math.max(0, Math.round(orders * 0.34)), liveHours: Math.max(0, Number((liveHours * 0.31).toFixed(1))) },
        { label: 'พุธ', sales: Math.round(demoSales * 0.52), orders: Math.max(0, Math.round(orders * 0.48)), liveHours: Math.max(0, Number((liveHours * 0.46).toFixed(1))) },
        { label: 'พฤหัส', sales: Math.round(demoSales * 0.64), orders: Math.max(0, Math.round(orders * 0.6)), liveHours: Math.max(0, Number((liveHours * 0.58).toFixed(1))) },
        { label: 'ศุกร์', sales: Math.round(demoSales * 0.76), orders: Math.max(0, Math.round(orders * 0.72)), liveHours: Math.max(0, Number((liveHours * 0.7).toFixed(1))) },
        { label: 'เสาร์', sales: Math.round(demoSales * 0.88), orders: Math.max(0, Math.round(orders * 0.84)), liveHours: Math.max(0, Number((liveHours * 0.84).toFixed(1))) },
        { label: 'วันนี้', sales: demoSales, orders, liveHours: Number(liveHours.toFixed(1)) },
      ],
    },
    wallet: {
      credit: 0,
      currency: 'THB',
    },
    package: {
      id: 'demo-package',
      name: 'Demo Package',
      code: 'DEMO',
      expiresAt: null,
      priceBaht: 0,
      durationDays: 30,
      limits: {
        accounts: 10,
        liveChannels: 10,
        videos: 50,
        storageGb: 20,
        proxies: 10,
      },
    },
  });
}


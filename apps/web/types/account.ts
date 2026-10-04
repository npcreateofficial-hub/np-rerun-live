export type AccountStatus = 'LIVE' | 'NOTLIVE';

export type StreamPlatform = 'SHOPEE' | 'TIKTOK';

export type LiveChannel = {
  id: string;
  userId: string;
  name: string;
  isOnline: boolean;
  proxyId?: string | null;
  platform?: StreamPlatform | string;
  accountName?: string | null;
  shopId?: string | null;
  platformUid?: string | null;
  avatar?: string | null;
  status?: string | null;
  cookie?: string | null;
  cookieValid?: boolean | null;
  rtmpUrl?: string | null;
  streamKey?: string | null;
  coverImageUrl?: string | null;
  liveSessionId?: string | null;
  basketLinks?: string | null;
  basketItemsJson?: string | null;
  aiCommentApiKey?: string | null;
  aiCommentAutoReply?: boolean | null;
  videoQueueJson?: string | null;
  videoTitle?: string | null;
  caption?: string | null;
  description?: string | null;
  autoLive?: boolean | null;
  liveDurationMinutes?: number | null;
  restartDelayMinutes?: number | null;
  lastCheckedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};



export type LiveInsightProduct = {
  itemId: number;
  title: string;
  coverImage?: string | null;
  minPrice: number;
  maxPrice: number;
  productClicks: number;
  ctr: number;
  atc: number;
  ordersCreated: number;
  revenue: number;
  itemSold: number;
  cor: number;
  confirmedOrderCnt: number;
  confirmedRevenue: number;
  confirmedItemSold: number;
  confirmedCor: number;
  paidOrderCnt: number;
  paidRevenue: number;
  paidItemSold: number;
  paidCor: number;
};
export type LiveChannelInsights = {
  channelId: string;
  channelName: string;
  platform?: string | null;
  liveSessionId?: string | null;
  startedAt?: string | null;
  rerun?: {
    id: string;
    title: string;
    status: string;
    videoTitle?: string | null;
    startedAt?: string | null;
    stoppedAt?: string | null;
  } | null;
  products?: {
    page: number;
    pageSize: number;
    total: number;
    totalPage: number;
    list: LiveInsightProduct[];
  } | null;
  stats: {
    sessionId: string | null;
    isLive: boolean;
    status: string;
    liveSeconds: number;
    totalSales: number;
    salesPerHour: number;
    viewers: number;
    orders: number;
    productsSold: number;
    buyers: number;
    addedToCart: number;
    currentViewers: number;
    peakViewers: number;
    views: number;
    averageWatchSeconds: number;
    likes: number;
    comments: number;
    shares: number;
    newFollowers: number;
    confirmedBuyers?: number;
    paidBuyers?: number;
    confirmedItemsSold?: number;
    confirmedOrders?: number;
    confirmedGmv?: number;
    paidItemsSold?: number;
    paidOrders?: number;
    paidGmv?: number;
    ctr?: number;
    conversionRate?: number;
    confirmedConversionRate?: number;
    paidConversionRate?: number;
    commentsRate?: number;
    gpm?: number;
    confirmedGpm?: number;
    paidGpm?: number;
    averageBasketSize?: number;
    confirmedAverageBasketSize?: number;
    paidAverageBasketSize?: number;
    engagedCcu?: number;
    avgEngagedCcu?: number;
    engagedViewers?: number;
    commentsLastMinute?: number;
    addedToCartLastMinute?: number;
    placedDiscoveryGmv?: number;
    placedConversionGmv?: number;
    confirmedDiscoveryGmv?: number;
    confirmedConversionGmv?: number;    updatedAt: string;
    source: string;
  };
  limit: {
    maxLiveSeconds: number;
    remainingSafeSeconds: number;
    warning: boolean;
    exceeded: boolean;
  };
};
export type LiveChannelUsage = {
  used: number;
  limit: number;
  remaining: number;
  canCreate: boolean;
};

export type CreateLiveChannelPayload = {
  platform: StreamPlatform;
  cookie: string;
  sessionId?: string | null;
  liveUrl?: string | null;
  proxyId?: string | null;
};

export type CheckCookiePayload = CreateLiveChannelPayload;

export type CheckCookieResult = {
  valid: boolean;
  platform: StreamPlatform;
  accountName?: string | null;
  name?: string | null;
  shopId?: string | null;
  userId?: string | null;
  platformUid?: string | null;
  username?: string | null;
  avatar?: string | null;
  liveAuth?: boolean | null;
  source?: string | null;
  message?: string;
};

export type UpdateLiveChannelPayload = {
  name?: string;
  cookie?: string | null;
  proxyId?: string | null;
  platform?: string;
  rtmpUrl?: string;
  streamKey?: string;
  coverImageUrl?: string | null;
  liveSessionId?: string | null;
  liveUrl?: string | null;
  sessionId?: string | null;
  basketLinks?: string | null;
  basketItemsJson?: string | null;
  aiCommentApiKey?: string | null;
  aiCommentAutoReply?: boolean | null;
  videoQueueJson?: string | null;
  caption?: string | null;
  description?: string | null;
  autoLive?: boolean | null;
  liveDurationMinutes?: number | null;
  restartDelayMinutes?: number | null;
  scheduledStartAt?: string | null;
  scheduledStopAt?: string | null;
};

export type ShopeeBasketItem = {
  shop_id?: number;
  item_id: number;
  url?: string;
  campaign_token?: string;
  [key: string]: unknown;
};

export type ShopeeBasketItemsResult = {
  sessionId: string;
  items: ShopeeBasketItem[];
  total: number;
  raw?: unknown;
};

export type ShopeeProductDetail = {
  shopId: number;
  itemId: number;
  url: string;
  name: string | null;
  image: string | null;
  imageUrl: string | null;
  videoId?: string | null;
  videoUrl?: string | null;
  videoThumbnailUrl?: string | null;
  videoDurationSec?: number | null;
  price: number | null;
  priceMin: number | null;
  priceMax: number | null;
  priceBeforeDiscount: number | null;
  stock: number | null;
  sold: number | null;
  rating: number | null;
  ratingCount: number | null;
  discount: number | string | null;
  commissionRate: number | null;
  isOutOfStock: boolean;
  error: string | null;
  raw?: unknown;
};

export type ShopeeProductDetailsPayload = {
  cookie?: string | null;
  productUrl?: string | null;
  productUrls?: string[];
  shopId?: string | number | null;
  itemId?: string | number | null;
  items?: ShopeeBasketItem[];
};

export type ShopeeProductDetailsResult = {
  sessionId: string | null;
  items: ShopeeProductDetail[];
};

export type ShopeeScreenRankingItem = {
  shopId: number;
  itemId: number;
  url: string;
  screenRank: number | null;
  screenRankLabel: string;
  rankingType: string | null;
  score: number | null;
  ctr: number | null;
  cvr: number | null;
  viewCount: number | null;
  liveSessionId: string | null;
  matched: boolean;
  sessionCount: number;
  previewImage?: string | null;
  error?: string | null;
};

export type ShopeeScreenRankingsResult = {
  sessionId: string | null;
  items: ShopeeScreenRankingItem[];
};
export type ShowShopeeBasketItemPayload = {
  clear?: boolean;
  productUrl?: string | null;
  shopId?: string | number | null;
  itemId?: string | number | null;
  item?: ShopeeBasketItem | null;
};

export type ShowShopeeBasketItemResult = {
  sessionId: string;
  shown: boolean;
  cleared?: boolean;
  item?: ShopeeBasketItem | null;
  raw?: unknown;
};

export type ShopeeShowLoopResult = {
  liveChannelId: string;
  running: boolean;
  stopped?: boolean;
  itemCount?: number;
  defaultSeconds?: number;
  items?: Array<ShopeeBasketItem & { pinOrder?: number; pinSeconds?: number }>;
};
export type UpdateLiveChannelStatusPayload = {
  isOnline: boolean;
};

export type AdsAccountRecord = {
  id: string;
  userId: string;
  accountName: string;
  shopName?: string | null;
  shopId?: string | null;
  status: string;
  note?: string | null;
  checkedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  cookiePresent?: boolean;
  cookieMasked?: string | null;
};

export type CreateAdsAccountPayload = {
  accountName: string;
  shopName?: string | null;
  shopId?: string | null;
  adsCookie?: string | null;
  note?: string | null;
};

export type CreateLiveCampaignPayload = {
  name: string;
  dailyBudget?: number;
  objective?: 'max_gmv' | 'max_view' | 'max_gmv_roi_two';
  dryRun?: boolean;
  automationSettings?: unknown;
};

export type CreateLiveCampaignResult = {
  created: boolean;
  dryRun?: boolean;
  account?: AdsAccountRecord;
  request?: {
    referenceId: string;
    name: string;
    objective: string;
    dailyBudget: number;
    dailyBudgetBaht: number | null;
  };
  campaignId?: number;
  campaignUuid?: string | null;
  shopeeMessage?: string;
  meta?: unknown;
  budget?: unknown;
  shopee?: unknown;
};

export type AdsLiveCampaignRecord = {
  id: string;
  campaignId: number;
  campaignUuid?: string | null;
  name: string;
  objective: string;
  state: string;
  dailyBudget?: number | null;
  dailyBudgetBaht?: number | null;
  automationSettings?: unknown;
  totalBudget?: number | null;
  totalBudgetBaht?: number | null;
  startTime?: number | null;
  endTime?: number | null;
  timeSlotList?: Array<{ start_time?: number; end_time?: number }> | null;
  roiTwoTarget?: number | null;
  roiTwoTargetValue?: number | null;
  targetBroadRoi?: number | null;
  metrics?: {
    views?: number | null;
    orders?: number | null;
    conversionRate?: number | null;
    salesBaht?: number | null;
    costBaht?: number | null;
    roas?: number | null;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type LiveCampaignHistoryResult = {
  source: 'shopee' | 'local';
  campaignId: number;
  history?: unknown;
  attempts?: unknown[];
};

export type UpdateLiveCampaignStatePayload = {
  type: 'pause' | 'resume' | 'stop';
  startTime?: number;
  endTime?: number;
  objective?: 'max_gmv' | 'max_view' | 'max_gmv_roi_two';
};

export type UpdateLiveCampaignPayload = {
  name?: string;
  dailyBudget?: number;
  objective?: 'max_gmv' | 'max_view' | 'max_gmv_roi_two';
  automationSettings?: unknown;
};

export type UpdateLiveCampaignResult = {
  success: boolean;
  account?: AdsAccountRecord;
  cookieSource?: 'ads-account' | 'live-channel' | null;
  liveChannelId?: string | null;
  campaign?: AdsLiveCampaignRecord | null;
  campaignId: number;
  dailyBudget?: number;
  dailyBudgetBaht?: number | null;
  shopee?: unknown;
};

export type UpdateLiveCampaignStateResult = {
  success: boolean;
  account?: AdsAccountRecord;
  cookieSource?: 'ads-account' | 'live-channel' | null;
  liveChannelId?: string | null;
  campaignId: number;
  replacementCampaignId?: number | null;
  replacementCampaign?: AdsLiveCampaignRecord | null;
  action: 'pause' | 'resume' | 'stop';
  accepted?: boolean;
  state?: string | null;
  campaignName?: string | null;
  overlap?: unknown;
  restarted?: boolean;
  shopee?: unknown;
};

export type DeleteLiveCampaignResult = {
  success: boolean;
  account?: AdsAccountRecord;
  cookieSource?: 'ads-account' | 'live-channel' | null;
  liveChannelId?: string | null;
  campaignId: number;
  campaignName?: string | null;
  state?: string | null;
  deletedLocal: boolean;
  shopee?: unknown;
};

export type AccountPlatform = StreamPlatform | 'LIVE_CHANNEL';

export type Account = LiveChannel;




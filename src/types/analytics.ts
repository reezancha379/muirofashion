export interface ClickEvent {
  id: string;
  productId: string;
  productTitle: string;
  lookId?: string;
  merchant: string;
  timestamp: string;
  device: 'mobile' | 'desktop' | 'tablet';
  referrer: string;
  utmSource?: string;
  utmCampaign?: string;
  ipHash: string;
  isBot: boolean;
  estimatedCommission: number;
}

export interface AnalyticsStats {
  totalImpressions: number;
  totalClicks: number;
  ctr: number;
  estimatedEarnings: number;
  mobilePercentage: number;
  topLookbooks: { id: string; title: string; clicks: number; views: number; ctr: number }[];
  topProducts: { id: string; title: string; clicks: number; earnings: number; merchant: string; image: string }[];
  recentClicks: ClickEvent[];
  clicksByDay: { date: string; clicks: number; impressions: number; earnings: number }[];
  trafficSources: { source: string; clicks: number; percentage: number }[];
}

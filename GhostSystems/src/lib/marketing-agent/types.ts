/**
 * Marketing Agent - Type Definitions
 */

export type MarketingStrategyType = 
  | 'email_campaign'
  | 'seo_optimization'
  | 'content_marketing'
  | 'social_media'
  | 'promotion'
  | 'traffic_generation'
  | 'bundle_creation';

export type MarketingRecommendationStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed'
  | 'failed';

export type CampaignStatus = 
  | 'draft'
  | 'scheduled'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled';

export interface MarketingRecommendation {
  id: string;
  type: MarketingStrategyType;
  priority: 'high' | 'medium' | 'low';
  
  // Content
  title: string;
  description: string;
  currentState: string;
  proposedState: string;
  
  // Implementation details
  implementation: {
    campaignType: MarketingStrategyType;
    target?: string; // Product ID, collection ID, etc.
    steps: string[];
    estimatedEffort: string; // 'low', 'medium', 'high'
    resources?: Record<string, any>;
  };
  
  // Metrics
  metrics: {
    expectedImpact: number; // Percentage improvement
    expectedTraffic?: number;
    expectedConversions?: number;
    expectedRevenue?: number;
    confidence: number; // 0-1 scale
    basedOn: string[]; // Data sources used
  };
  
  // Status tracking
  status: MarketingRecommendationStatus;
  createdAt: Date;
  approvedAt?: Date;
  executedAt?: Date;
  completedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  
  // Results after execution
  results?: {
    actualTraffic?: number;
    actualConversions?: number;
    actualRevenue?: number;
    roi?: number;
    performanceVsExpected?: number; // Percentage difference
    measurementPeriod: number; // days
  };
}

export interface MarketingAnalytics {
  // Email metrics
  email: {
    totalSent: number;
    totalOpened: number;
    openRate: number;
    totalClicked: number;
    clickRate: number;
    conversions: number;
    conversionRate: number;
    revenue: number;
    avgRevenuePerEmail: number;
  };
  
  // SEO metrics
  seo: {
    organicTraffic: number;
    keywordRankings: {
      top10: number;
      top50: number;
      top100: number;
    };
    avgPosition: number;
    clickThroughRate: number;
    impressions: number;
  };
  
  // Content metrics
  content: {
    totalPosts: number;
    totalViews: number;
    avgViewsPerPost: number;
    avgTimeOnPage: number;
    bounceRate: number;
    conversions: number;
  };
  
  // Social media metrics (if available)
  social: {
    totalPosts: number;
    totalEngagements: number;
    avgEngagementRate: number;
    reach: number;
    clicks: number;
  };
  
  // Campaign metrics
  campaigns: {
    active: number;
    completed: number;
    totalRevenue: number;
    avgROI: number;
    topPerformingType: string;
  };
  
  // Traffic sources
  traffic: {
    organic: number;
    direct: number;
    referral: number;
    social: number;
    email: number;
    paid?: number;
  };
  
  // Conversion funnel
  conversion: {
    visitors: number;
    addToCart: number;
    checkout: number;
    purchase: number;
    conversionRate: number;
    avgOrderValue: number;
  };
  
  // Timestamp
  collectedAt: Date;
}

export interface CampaignExecution {
  id: string;
  recommendationId: string;
  type: MarketingStrategyType;
  status: CampaignStatus;
  
  // Execution details
  startedAt?: Date;
  completedAt?: Date;
  scheduledFor?: Date;
  
  // Configuration
  config: Record<string, any>;
  
  // Results
  metrics?: {
    sent?: number;
    opened?: number;
    clicked?: number;
    conversions?: number;
    revenue?: number;
    traffic?: number;
  };
  
  // Error handling
  error?: string;
  retryCount?: number;
}


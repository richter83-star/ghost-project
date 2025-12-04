/**
 * Store Design Agent - Type Definitions
 */

export type RecommendationType = 
  | 'homepage'
  | 'product_page'
  | 'collection'
  | 'navigation'
  | 'seo'
  | 'brand'
  | 'copy'
  | 'image';

export type RecommendationPriority = 'high' | 'medium' | 'low';

export type RecommendationStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'applied'
  | 'reverted'
  | 'failed';

export type ImpactArea = 'conversion' | 'brand' | 'seo' | 'ux' | 'all';

export interface DesignRecommendation {
  id: string;
  type: RecommendationType;
  priority: RecommendationPriority;
  impact: ImpactArea;
  
  // Content
  title: string;
  description: string;
  currentState: string;
  proposedState: string;
  
  // Implementation details
  implementation: {
    type: 'theme_asset' | 'product' | 'collection' | 'metafield' | 'setting';
    target: string;          // File path, product ID, etc.
    changes: Record<string, any>;
    backup?: string;         // Original value for rollback
  };
  
  // Metrics
  metrics: {
    estimatedImpact: number;  // Percentage improvement
    confidence: number;       // 0-1 scale
    basedOn: string[];       // Data sources used
  };
  
  // Status tracking
  status: RecommendationStatus;
  createdAt: Date;
  approvedAt?: Date;
  appliedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  
  // Results after application
  results?: {
    before: Record<string, number>;
    after: Record<string, number>;
    improvement: number;
    measurementPeriod: number; // days
  };
}

export interface StoreAnalytics {
  // Traffic metrics
  pageViews: {
    total: number;
    byPage: Record<string, number>;
    trend: 'up' | 'down' | 'stable';
  };
  
  // Conversion funnel
  conversionFunnel: {
    homepage: number;
    collection: number;
    product: number;
    cart: number;
    checkout: number;
    purchase: number;
    overallRate: number;
  };
  
  // Product performance
  products: {
    total: number;
    withImages: number;
    withDescriptions: number;
    avgDescriptionLength: number;
    topPerformers: Array<{
      id: string;
      title: string;
      sales: number;
      revenue: number;
    }>;
    underperformers: Array<{
      id: string;
      title: string;
      views: number;
      sales: number;
    }>;
  };
  
  // SEO metrics
  seo: {
    productsWithMeta: number;
    productsMissingMeta: number;
    collectionsWithMeta: number;
    avgTitleLength: number;
    avgDescriptionLength: number;
    issues: string[];
  };
  
  // Customer insights
  customers: {
    total: number;
    returning: number;
    avgOrderValue: number;
    topLocations: string[];
  };
  
  // Theme analysis
  theme: {
    name: string;
    totalAssets: number;
    customCSS: boolean;
    customJS: boolean;
    lastModified: string;
  };
  
  // Collections
  collections: {
    total: number;
    withImages: number;
    withDescriptions: number;
    avgProductCount: number;
  };
  
  // Timestamp
  collectedAt: Date;
}

export interface DesignAgentConfig {
  enabled: boolean;
  intervalHours: number;
  autoApply: boolean;
  minConfidence: number;
  maxDailyChanges: number;
  notifyEmail: string;
  priorityOrder: RecommendationType[];
}

export interface ThemeBackup {
  id: string;
  themeId: number;
  themeName: string;
  assets: Array<{
    key: string;
    value: string;
  }>;
  createdAt: Date;
  reason: string;
}

export interface ABTest {
  id: string;
  recommendationId: string;
  name: string;
  
  variants: {
    control: Record<string, any>;
    treatment: Record<string, any>;
  };
  
  metrics: {
    control: {
      views: number;
      conversions: number;
      revenue: number;
    };
    treatment: {
      views: number;
      conversions: number;
      revenue: number;
    };
  };
  
  status: 'running' | 'completed' | 'stopped';
  winner?: 'control' | 'treatment' | 'inconclusive';
  significance?: number;
  
  startedAt: Date;
  endedAt?: Date;
}


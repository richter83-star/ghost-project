/**
 * Adaptive AI Analytics Engine
 * 
 * Learns from sales data, product performance, and customer behavior
 * to continuously improve product generation and marketing strategies.
 */

import { getFirestore } from 'firebase-admin/firestore';
import { fetchOrders, fetchProducts } from '../shopify.js';
import { getGumroadSales } from '../analytics/gumroadPull.js';
import { getLemonSales } from '../analytics/lemonPull.js';
import { SaleRecord } from '../analytics/types.js';

export interface ProductPerformance {
  productId: string;
  title: string;
  productType: string;
  niche?: string;
  tags: string[];
  
  // Sales metrics
  totalSales: number;
  totalRevenue: number;
  avgOrderValue: number;
  conversionRate: number;
  
  // Time-based metrics
  daysOnMarket: number;
  salesVelocity: number; // sales per day
  revenueVelocity: number; // revenue per day
  
  // Price metrics
  currentPrice: number;
  priceHistory: Array<{ price: number; date: string; sales: number }>;
  priceElasticity: number; // how sensitive sales are to price changes
  
  // Customer metrics
  customerCount: number;
  repeatCustomerRate: number;
  
  // Trend analysis
  trend: 'growing' | 'stable' | 'declining';
  growthRate: number; // percentage change in sales velocity
}

export interface NichePerformance {
  niche: string;
  totalProducts: number;
  totalSales: number;
  totalRevenue: number;
  avgConversionRate: number;
  avgPrice: number;
  bestPerformingPriceRange: { min: number; max: number };
  trendingTags: string[];
  growthRate: number;
}

export interface MarketInsights {
  topPerformingProducts: ProductPerformance[];
  topPerformingNiches: NichePerformance[];
  trendingProductTypes: Array<{ type: string; growthRate: number; avgRevenue: number }>;
  optimalPriceRanges: Record<string, { min: number; max: number; avgRevenue: number }>;
  customerSegments: Array<{ segment: string; avgOrderValue: number; preferredTypes: string[] }>;
  seasonalTrends: Array<{ period: string; productTypes: string[]; avgRevenue: number }>;
  recommendations: {
    generateMore: Array<{ type: string; niche: string; reason: string }>;
    adjustPricing: Array<{ productId: string; currentPrice: number; recommendedPrice: number; reason: string }>;
    discontinue: Array<{ productId: string; reason: string }>;
  };
}

/**
 * Aggregates sales data from all platforms (Shopify, Gumroad, Lemon)
 */
export async function aggregateSalesData(
  days: number = 90
): Promise<SaleRecord[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const allSales: SaleRecord[] = [];

  // Fetch from Shopify (skip if credentials not configured)
  const shopifyUrl = process.env.SHOPIFY_STORE_URL?.trim();
  const shopifyToken = process.env.SHOPIFY_ADMIN_API_TOKEN?.trim();
  
  if (shopifyUrl && shopifyToken && shopifyUrl !== '' && shopifyToken !== '') {
    try {
      const orders = await fetchOrders('any');
      for (const order of orders) {
        const orderDate = new Date(order.created_at);
        if (orderDate >= cutoffDate) {
          for (const item of order.line_items || []) {
            allSales.push({
              id: `${order.id}-${item.id}`,
              sku: item.sku || item.product_id?.toString() || '',
              title: item.title || 'Unknown Product',
              amount_cents: Math.round((item.price || 0) * 100),
              created_at: order.created_at,
              platform: 'shopify' as const,
              email: order.email || null,
            });
          }
        }
      }
    } catch (error: any) {
      // Silently skip if Shopify is not configured - that's okay
      if (!error.message?.includes('ENOTFOUND') && !error.message?.includes('admin')) {
        console.warn('[AdaptiveAI] Failed to fetch Shopify orders:', error.message);
      }
    }
  } else {
    console.log('[AdaptiveAI] Shopify credentials not configured, skipping Shopify sales data');
  }

  // Fetch from Gumroad
  try {
    const gumroadSales = await getGumroadSales();
    allSales.push(...gumroadSales.filter(sale => {
      const saleDate = new Date(sale.created_at);
      return saleDate >= cutoffDate;
    }));
  } catch (error) {
    console.error('[AdaptiveAI] Failed to fetch Gumroad sales:', error);
  }

  // Fetch from Lemon
  try {
    const lemonSales = await getLemonSales();
    allSales.push(...lemonSales.filter(sale => {
      const saleDate = new Date(sale.created_at);
      return saleDate >= cutoffDate;
    }));
  } catch (error) {
    console.error('[AdaptiveAI] Failed to fetch Lemon sales:', error);
  }

  return allSales;
}

/**
 * Analyzes product performance from Firestore and sales data
 */
export async function analyzeProductPerformance(
  collectionName: string = 'products'
): Promise<ProductPerformance[]> {
  const db = getFirestore();
  const sales = await aggregateSalesData(90);
  
  // Group sales by product (using title/sku matching)
  const salesByProduct = new Map<string, SaleRecord[]>();
  
  for (const sale of sales) {
    const key = sale.sku || sale.title.toLowerCase().trim();
    if (!salesByProduct.has(key)) {
      salesByProduct.set(key, []);
    }
    salesByProduct.get(key)!.push(sale);
  }

  // Fetch all products from Firestore
  const productsSnapshot = await db.collection(collectionName).get();
  const performances: ProductPerformance[] = [];

  for (const doc of productsSnapshot.docs) {
    const data = doc.data();
    const productSales = salesByProduct.get(data.sku || data.title?.toLowerCase().trim() || '') || [];
    
    // Include all products for analysis, even without sales
    // (this helps show what exists in the catalog)

    const totalSales = productSales.length;
    const totalRevenue = productSales.reduce((sum, s) => sum + s.amount_cents, 0);
    const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;
    
    // Calculate conversion rate (simplified - would need view data for real conversion)
    // For now, use sales velocity as proxy
    // Handle createdAt as Timestamp, Date, or string
    let createdAt: Date;
    if (data.createdAt) {
      if (typeof data.createdAt.toDate === 'function') {
        // Firestore Timestamp
        createdAt = data.createdAt.toDate();
      } else if (data.createdAt instanceof Date) {
        createdAt = data.createdAt;
      } else if (typeof data.createdAt === 'string') {
        createdAt = new Date(data.createdAt);
      } else if (data.createdAt.seconds) {
        // Timestamp object with seconds
        createdAt = new Date(data.createdAt.seconds * 1000);
      } else {
        createdAt = new Date();
      }
    } else {
      createdAt = new Date();
    }
    const daysOnMarket = Math.max(1, Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24)));
    const salesVelocity = totalSales / daysOnMarket;
    
    // Price history (simplified - would track actual price changes)
    const currentPrice = data.price_usd || data.price || 0;
    const priceHistory = [{
      price: currentPrice,
      date: createdAt.toISOString(),
      sales: totalSales,
    }];

    // Calculate trend (compare last 30 days vs previous 30 days)
    const now = new Date();
    const last30Days = productSales.filter(s => {
      const saleDate = new Date(s.created_at);
      return saleDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    });
    const prev30Days = productSales.filter(s => {
      const saleDate = new Date(s.created_at);
      const daysAgo = (now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo >= 30 && daysAgo < 60;
    });
    
    const recentVelocity = last30Days.length / 30;
    const previousVelocity = prev30Days.length / 30;
    const growthRate = previousVelocity > 0 
      ? ((recentVelocity - previousVelocity) / previousVelocity) * 100 
      : recentVelocity > 0 ? 100 : 0;
    
    const trend: 'growing' | 'stable' | 'declining' = 
      growthRate > 10 ? 'growing' : 
      growthRate < -10 ? 'declining' : 
      'stable';

    // Customer metrics (simplified)
    const uniqueCustomers = new Set(productSales.map(s => s.email).filter(Boolean));
    const customerCount = uniqueCustomers.size;
    const repeatCustomerRate = totalSales > 0 ? (totalSales - customerCount) / totalSales : 0;

    performances.push({
      productId: doc.id,
      title: data.title || 'Untitled',
      productType: data.product_type || data.productType || 'unknown',
      niche: data.niche,
      tags: Array.isArray(data.tags) ? data.tags : [],
      totalSales,
      totalRevenue: totalRevenue / 100, // Convert cents to dollars
      avgOrderValue: avgOrderValue / 100,
      conversionRate: salesVelocity > 0.1 ? 0.05 : 0, // Placeholder
      daysOnMarket,
      salesVelocity,
      revenueVelocity: (totalRevenue / 100) / daysOnMarket,
      currentPrice,
      priceHistory,
      priceElasticity: 0, // Would need A/B test data
      customerCount,
      repeatCustomerRate,
      trend,
      growthRate,
    });
  }

  return performances.sort((a, b) => b.totalRevenue - a.totalRevenue);
}

/**
 * Analyzes niche performance
 */
export async function analyzeNichePerformance(
  productPerformances: ProductPerformance[]
): Promise<NichePerformance[]> {
  const nicheMap = new Map<string, ProductPerformance[]>();

  for (const perf of productPerformances) {
    if (!perf.niche) continue;
    if (!nicheMap.has(perf.niche)) {
      nicheMap.set(perf.niche, []);
    }
    nicheMap.get(perf.niche)!.push(perf);
  }

  const nichePerformances: NichePerformance[] = [];

  for (const [niche, products] of nicheMap.entries()) {
    const totalProducts = products.length;
    const totalSales = products.reduce((sum, p) => sum + p.totalSales, 0);
    const totalRevenue = products.reduce((sum, p) => sum + p.totalRevenue, 0);
    const avgConversionRate = products.reduce((sum, p) => sum + p.conversionRate, 0) / totalProducts;
    const avgPrice = products.reduce((sum, p) => sum + p.currentPrice, 0) / totalProducts;
    
    // Find best performing price range
    const prices = products.map(p => p.currentPrice).filter(p => p > 0);
    const sortedPrices = prices.sort((a, b) => a - b);
    const priceRange = {
      min: sortedPrices[0] || 0,
      max: sortedPrices[sortedPrices.length - 1] || 0,
    };

    // Get trending tags
    const tagCounts = new Map<string, number>();
    for (const product of products) {
      for (const tag of product.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
    const trendingTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);

    // Calculate growth rate
    const avgGrowthRate = products.reduce((sum, p) => sum + p.growthRate, 0) / totalProducts;

    nichePerformances.push({
      niche,
      totalProducts,
      totalSales,
      totalRevenue,
      avgConversionRate,
      avgPrice,
      bestPerformingPriceRange: priceRange,
      trendingTags,
      growthRate: avgGrowthRate,
    });
  }

  return nichePerformances.sort((a, b) => b.totalRevenue - a.totalRevenue);
}

/**
 * Generates comprehensive market insights
 */
export async function generateMarketInsights(
  collectionName: string = 'products'
): Promise<MarketInsights> {
  const productPerformances = await analyzeProductPerformance(collectionName);
  const nichePerformances = await analyzeNichePerformance(productPerformances);

  // Top performing products (top 20%)
  const topProducts = productPerformances
    .filter(p => p.totalSales > 0)
    .slice(0, Math.max(10, Math.floor(productPerformances.length * 0.2)));

  // Top performing niches
  const topNiches = nichePerformances.slice(0, 5);

  // Trending product types
  const typeMap = new Map<string, { count: number; revenue: number; growth: number }>();
  for (const perf of productPerformances) {
    if (!typeMap.has(perf.productType)) {
      typeMap.set(perf.productType, { count: 0, revenue: 0, growth: 0 });
    }
    const stats = typeMap.get(perf.productType)!;
    stats.count++;
    stats.revenue += perf.totalRevenue;
    stats.growth += perf.growthRate;
  }
  const trendingTypes = Array.from(typeMap.entries())
    .map(([type, stats]) => ({
      type,
      growthRate: stats.growth / stats.count,
      avgRevenue: stats.revenue / stats.count,
    }))
    .sort((a, b) => b.growthRate - a.growthRate);

  // Optimal price ranges by product type
  const priceRangesByType = new Map<string, { prices: number[]; revenues: number[] }>();
  for (const perf of productPerformances) {
    if (perf.currentPrice <= 0) continue;
    if (!priceRangesByType.has(perf.productType)) {
      priceRangesByType.set(perf.productType, { prices: [], revenues: [] });
    }
    const range = priceRangesByType.get(perf.productType)!;
    range.prices.push(perf.currentPrice);
    range.revenues.push(perf.totalRevenue);
  }
  
  const optimalPriceRanges: Record<string, { min: number; max: number; avgRevenue: number }> = {};
  for (const [type, { prices, revenues }] of priceRangesByType.entries()) {
    if (prices.length === 0) continue;
    const sorted = prices.map((p, i) => ({ price: p, revenue: revenues[i] }))
      .sort((a, b) => b.revenue - a.revenue);
    const top20Percent = sorted.slice(0, Math.max(1, Math.floor(sorted.length * 0.2)));
    optimalPriceRanges[type] = {
      min: Math.min(...top20Percent.map(t => t.price)),
      max: Math.max(...top20Percent.map(t => t.price)),
      avgRevenue: top20Percent.reduce((sum, t) => sum + t.revenue, 0) / top20Percent.length,
    };
  }

  // Generate recommendations
  const recommendations = {
    generateMore: [] as Array<{ type: string; niche: string; reason: string }>,
    adjustPricing: [] as Array<{ productId: string; currentPrice: number; recommendedPrice: number; reason: string }>,
    discontinue: [] as Array<{ productId: string; reason: string }>,
  };

  // Recommend generating more of top-performing types/niches
  for (const niche of topNiches) {
    if (niche.growthRate > 20) {
      for (const type of trendingTypes.slice(0, 3)) {
        recommendations.generateMore.push({
          type: type.type,
          niche: niche.niche,
          reason: `High growth rate (${niche.growthRate.toFixed(1)}%) and strong revenue ($${niche.totalRevenue.toFixed(2)})`,
        });
      }
    }
  }

  // Recommend price adjustments
  for (const perf of productPerformances) {
    if (perf.totalSales === 0 && perf.daysOnMarket > 30) {
      const optimalRange = optimalPriceRanges[perf.productType];
      if (optimalRange && perf.currentPrice > optimalRange.max) {
        recommendations.adjustPricing.push({
          productId: perf.productId,
          currentPrice: perf.currentPrice,
          recommendedPrice: optimalRange.max,
          reason: `No sales in ${perf.daysOnMarket} days, price above optimal range`,
        });
      }
    }
  }

  // Recommend discontinuing underperformers
  for (const perf of productPerformances) {
    if (perf.totalSales === 0 && perf.daysOnMarket > 90) {
      recommendations.discontinue.push({
        productId: perf.productId,
        reason: `No sales in ${perf.daysOnMarket} days despite optimal pricing`,
      });
    }
  }

  return {
    topPerformingProducts: topProducts,
    topPerformingNiches: topNiches,
    trendingProductTypes: trendingTypes,
    optimalPriceRanges,
    customerSegments: [], // Would need customer data analysis
    seasonalTrends: [], // Would need time-series analysis
    recommendations,
  };
}


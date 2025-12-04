/**
 * Dynamic Pricing Engine
 * 
 * Automatically adjusts product prices based on sales performance,
 * market insights, and configurable rules.
 */

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { analyzeProductPerformance, ProductPerformance } from './adaptive-ai/analytics.js';
import { updateProductPrice, fetchProducts } from './shopify.js';

// Configuration
const MIN_PRICE = 5; // $5 minimum
const MAX_PRICE = 99; // $99 maximum
const MAX_CHANGE_PERCENT = 30; // Max 30% change per update
const MIN_DAYS_BETWEEN_CHANGES = 7; // Don't change price more than once per week
const PRICE_HISTORY_COLLECTION = 'price_history';

interface PricingRule {
  name: string;
  condition: (perf: ProductPerformance) => boolean;
  adjustment: number; // Percentage adjustment (positive = increase, negative = decrease)
  reason: string;
}

interface PriceRecommendation {
  productId: string;
  shopifyProductId?: string;
  title: string;
  currentPrice: number;
  recommendedPrice: number;
  changePercent: number;
  rule: string;
  reason: string;
  shouldApply: boolean;
  skipReason?: string;
}

/**
 * Pricing rules - evaluated in order, first matching rule applies
 */
const PRICING_RULES: PricingRule[] = [
  {
    name: 'high_performer',
    condition: (perf) => perf.salesVelocity >= 0.7 && perf.daysOnMarket >= 7,
    adjustment: 15, // Increase by 15%
    reason: 'High sales velocity (0.7+ sales/day)',
  },
  {
    name: 'strong_performer',
    condition: (perf) => perf.salesVelocity >= 0.3 && perf.daysOnMarket >= 14,
    adjustment: 10, // Increase by 10%
    reason: 'Strong sales velocity (0.3+ sales/day)',
  },
  {
    name: 'declining_sales',
    condition: (perf) => perf.trend === 'declining' && perf.growthRate < -20 && perf.totalSales > 0,
    adjustment: -10, // Decrease by 10%
    reason: 'Declining sales trend (-20% growth)',
  },
  {
    name: 'no_sales_30_days',
    condition: (perf) => perf.totalSales === 0 && perf.daysOnMarket >= 30,
    adjustment: -20, // Decrease by 20%
    reason: 'No sales in 30+ days',
  },
  {
    name: 'no_sales_14_days',
    condition: (perf) => perf.totalSales === 0 && perf.daysOnMarket >= 14,
    adjustment: -10, // Decrease by 10%
    reason: 'No sales in 14+ days',
  },
  {
    name: 'new_product_boost',
    condition: (perf) => perf.daysOnMarket <= 7 && perf.totalSales >= 2,
    adjustment: 5, // Small increase for early traction
    reason: 'Early traction on new product',
  },
];

/**
 * Calculate new price with safety bounds
 */
function calculateNewPrice(
  currentPrice: number,
  adjustmentPercent: number
): { newPrice: number; actualChangePercent: number } {
  // Calculate raw new price
  let newPrice = currentPrice * (1 + adjustmentPercent / 100);
  
  // Apply min/max bounds
  newPrice = Math.max(MIN_PRICE, Math.min(MAX_PRICE, newPrice));
  
  // Round to 2 decimal places
  newPrice = Math.round(newPrice * 100) / 100;
  
  // Calculate actual change after bounds
  const actualChangePercent = ((newPrice - currentPrice) / currentPrice) * 100;
  
  // Cap change at MAX_CHANGE_PERCENT
  if (Math.abs(actualChangePercent) > MAX_CHANGE_PERCENT) {
    const cappedChange = MAX_CHANGE_PERCENT * Math.sign(adjustmentPercent);
    newPrice = currentPrice * (1 + cappedChange / 100);
    newPrice = Math.max(MIN_PRICE, Math.min(MAX_PRICE, newPrice));
    newPrice = Math.round(newPrice * 100) / 100;
  }
  
  return {
    newPrice,
    actualChangePercent: ((newPrice - currentPrice) / currentPrice) * 100,
  };
}

/**
 * Check if price was recently changed
 */
async function wasRecentlyChanged(
  db: FirebaseFirestore.Firestore,
  productId: string
): Promise<boolean> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MIN_DAYS_BETWEEN_CHANGES);

    const recentChanges = await db
      .collection(PRICE_HISTORY_COLLECTION)
      .where('productId', '==', productId)
      .where('changedAt', '>', cutoffDate)
      .limit(1)
      .get();

    return !recentChanges.empty;
  } catch (error) {
    return false; // Assume not recently changed if check fails
  }
}

/**
 * Log price change to Firestore
 */
async function logPriceChange(
  db: FirebaseFirestore.Firestore,
  recommendation: PriceRecommendation,
  applied: boolean
): Promise<void> {
  try {
    await db.collection(PRICE_HISTORY_COLLECTION).add({
      productId: recommendation.productId,
      shopifyProductId: recommendation.shopifyProductId,
      title: recommendation.title,
      oldPrice: recommendation.currentPrice,
      newPrice: recommendation.recommendedPrice,
      changePercent: recommendation.changePercent,
      rule: recommendation.rule,
      reason: recommendation.reason,
      applied,
      changedAt: FieldValue.serverTimestamp(),
    });
  } catch (error: any) {
    console.error('[DynamicPricing] Failed to log price change:', error.message);
  }
}

/**
 * Generate price recommendations based on product performance
 */
export async function generatePriceRecommendations(
  collectionName: string = 'products'
): Promise<PriceRecommendation[]> {
  console.log('[DynamicPricing] Analyzing product performance...');
  
  const performances = await analyzeProductPerformance(collectionName);
  const recommendations: PriceRecommendation[] = [];
  
  // Get Shopify products to map IDs
  let shopifyProducts: any[] = [];
  try {
    shopifyProducts = await fetchProducts();
  } catch (error) {
    console.warn('[DynamicPricing] Could not fetch Shopify products for ID mapping');
  }

  for (const perf of performances) {
    // Find matching rule
    const matchingRule = PRICING_RULES.find((rule) => rule.condition(perf));
    
    if (!matchingRule) {
      continue; // No rule matches, skip this product
    }

    const { newPrice, actualChangePercent } = calculateNewPrice(
      perf.currentPrice,
      matchingRule.adjustment
    );

    // Skip if no actual change
    if (Math.abs(actualChangePercent) < 1) {
      continue;
    }

    // Find Shopify product ID
    const shopifyProduct = shopifyProducts.find(
      (sp) => sp.title?.toLowerCase() === perf.title?.toLowerCase()
    );

    recommendations.push({
      productId: perf.productId,
      shopifyProductId: shopifyProduct?.id,
      title: perf.title,
      currentPrice: perf.currentPrice,
      recommendedPrice: newPrice,
      changePercent: actualChangePercent,
      rule: matchingRule.name,
      reason: matchingRule.reason,
      shouldApply: true,
    });
  }

  console.log(`[DynamicPricing] Generated ${recommendations.length} price recommendations`);
  return recommendations;
}

/**
 * Apply price recommendations to Shopify
 */
export async function applyPriceRecommendations(
  recommendations: PriceRecommendation[],
  dryRun: boolean = false
): Promise<{ applied: number; skipped: number; failed: number }> {
  const db = getFirestore();
  let applied = 0;
  let skipped = 0;
  let failed = 0;

  console.log(
    `[DynamicPricing] ${dryRun ? '(DRY RUN) ' : ''}Processing ${recommendations.length} recommendations...`
  );

  for (const rec of recommendations) {
    // Skip if no Shopify ID
    if (!rec.shopifyProductId) {
      console.log(`[DynamicPricing] Skipping ${rec.title}: No Shopify product ID`);
      rec.shouldApply = false;
      rec.skipReason = 'No Shopify product ID';
      skipped++;
      continue;
    }

    // Check if recently changed
    const recentlyChanged = await wasRecentlyChanged(db, rec.productId);
    if (recentlyChanged) {
      console.log(
        `[DynamicPricing] Skipping ${rec.title}: Price changed within last ${MIN_DAYS_BETWEEN_CHANGES} days`
      );
      rec.shouldApply = false;
      rec.skipReason = `Price changed within last ${MIN_DAYS_BETWEEN_CHANGES} days`;
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(
        `[DynamicPricing] Would update ${rec.title}: $${rec.currentPrice} → $${rec.recommendedPrice} (${rec.changePercent.toFixed(1)}%, ${rec.reason})`
      );
      applied++;
      continue;
    }

    // Apply price change
    try {
      await updateProductPrice(rec.shopifyProductId, rec.recommendedPrice);
      await logPriceChange(db, rec, true);
      console.log(
        `[DynamicPricing] ✅ Updated ${rec.title}: $${rec.currentPrice} → $${rec.recommendedPrice} (${rec.reason})`
      );
      applied++;
    } catch (error: any) {
      console.error(
        `[DynamicPricing] ❌ Failed to update ${rec.title}:`,
        error.message
      );
      await logPriceChange(db, rec, false);
      failed++;
    }

    // Rate limit
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log(
    `[DynamicPricing] Complete: ${applied} applied, ${skipped} skipped, ${failed} failed`
  );

  return { applied, skipped, failed };
}

/**
 * Run dynamic pricing optimization
 */
export async function runDynamicPricing(
  collectionName: string = 'products',
  dryRun: boolean = false
): Promise<{ recommendations: PriceRecommendation[]; results: { applied: number; skipped: number; failed: number } }> {
  const enablePricing = process.env.ENABLE_DYNAMIC_PRICING === 'true';
  
  if (!enablePricing && !dryRun) {
    console.log('[DynamicPricing] Dynamic pricing disabled (ENABLE_DYNAMIC_PRICING !== true)');
    return { recommendations: [], results: { applied: 0, skipped: 0, failed: 0 } };
  }

  console.log(`[DynamicPricing] 🔄 Running dynamic pricing optimization${dryRun ? ' (DRY RUN)' : ''}...`);
  
  const recommendations = await generatePriceRecommendations(collectionName);
  const results = await applyPriceRecommendations(recommendations, dryRun);

  return { recommendations, results };
}


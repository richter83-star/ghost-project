/**
 * Adaptive AI Listener
 * 
 * Monitors market performance and automatically generates new products
 * based on learned insights. Runs on a schedule to continuously adapt.
 */

import { getFirestore } from 'firebase-admin/firestore';
import { generateAndSaveProducts } from '../../lib/adaptive-ai/generator.js';
import { generateMarketInsights } from '../../lib/adaptive-ai/analytics.js';

const COLLECTION_NAME = process.env.FIRESTORE_JOBS_COLLECTION || 'products';

// Configuration
const GENERATION_INTERVAL_HOURS = parseInt(
  process.env.ADAPTIVE_AI_GENERATION_INTERVAL_HOURS || '24',
  10
); // Default: once per day

const MIN_PRODUCTS_TO_GENERATE = parseInt(
  process.env.ADAPTIVE_AI_MIN_PRODUCTS || '3',
  10
);

const MAX_PRODUCTS_TO_GENERATE = parseInt(
  process.env.ADAPTIVE_AI_MAX_PRODUCTS || '5',
  10
);

/**
 * Analyzes market and generates products if needed
 */
export async function runAdaptiveGeneration(): Promise<void> {
  console.log('[AdaptiveAI] 🔄 Starting adaptive generation cycle...');

  try {
    // Get market insights
    const insights = await generateMarketInsights(COLLECTION_NAME);
    
    // Determine how many products to generate based on market conditions
    let productsToGenerate = MIN_PRODUCTS_TO_GENERATE;

    // Generate more if we have strong signals
    const strongSignals = insights.recommendations.generateMore.filter(
      rec => insights.topPerformingNiches.some(
        niche => niche.niche === rec.niche && niche.growthRate > 20
      )
    ).length;

    if (strongSignals >= 3) {
      productsToGenerate = MAX_PRODUCTS_TO_GENERATE;
      console.log(`[AdaptiveAI] 📈 Strong market signals detected, generating ${productsToGenerate} products`);
    } else if (strongSignals >= 1) {
      productsToGenerate = Math.ceil((MIN_PRODUCTS_TO_GENERATE + MAX_PRODUCTS_TO_GENERATE) / 2);
      console.log(`[AdaptiveAI] 📊 Moderate market signals, generating ${productsToGenerate} products`);
    }

    // Generate products
    const createdIds = await generateAndSaveProducts(productsToGenerate, COLLECTION_NAME);

    if (createdIds.length > 0) {
      console.log(`[AdaptiveAI] ✅ Generated ${createdIds.length} products: ${createdIds.join(', ')}`);
    } else {
      console.log('[AdaptiveAI] ℹ️ No products generated (insufficient market data or no strategies)');
    }

    // Log insights summary
    console.log(`[AdaptiveAI] 📊 Market Summary:`);
    console.log(`  - Top performing products: ${insights.topPerformingProducts.length}`);
    console.log(`  - Top performing niches: ${insights.topPerformingNiches.length}`);
    console.log(`  - Trending types: ${insights.trendingProductTypes.length}`);
    console.log(`  - Recommendations: ${insights.recommendations.generateMore.length} generate, ${insights.recommendations.adjustPricing.length} adjust pricing, ${insights.recommendations.discontinue.length} discontinue`);

  } catch (error: any) {
    console.error('[AdaptiveAI] ❌ Adaptive generation failed:', error.message);
    throw error;
  }
}

/**
 * Starts the adaptive AI listener (scheduled generation)
 */
export function startAdaptiveAIListener(): void {
  console.log('[AdaptiveAI] 🧠 Starting Adaptive AI Listener...');
  console.log(`[AdaptiveAI] ⏰ Generation interval: ${GENERATION_INTERVAL_HOURS} hours`);

  // Run immediately on start
  runAdaptiveGeneration().catch(error => {
    console.error('[AdaptiveAI] ❌ Initial generation failed:', error);
  });

  // Schedule periodic generation
  const intervalMs = GENERATION_INTERVAL_HOURS * 60 * 60 * 1000;
  setInterval(() => {
    runAdaptiveGeneration().catch(error => {
      console.error('[AdaptiveAI] ❌ Scheduled generation failed:', error);
    });
  }, intervalMs);

  console.log('[AdaptiveAI] ✅ Adaptive AI Listener is active');
}


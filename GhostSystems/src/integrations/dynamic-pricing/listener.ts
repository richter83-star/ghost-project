/**
 * Dynamic Pricing Listener
 * 
 * Runs on a schedule to automatically optimize product prices
 * based on sales performance and market insights.
 */

import { runDynamicPricing } from '../../lib/dynamic-pricing.js';

// Configuration
const DEFAULT_INTERVAL_DAYS = 7; // Run weekly by default
const INTERVAL_DAYS = parseInt(
  process.env.DYNAMIC_PRICING_INTERVAL_DAYS || String(DEFAULT_INTERVAL_DAYS),
  10
);
const INTERVAL_MS = INTERVAL_DAYS * 24 * 60 * 60 * 1000;

let isRunning = false;
let lastRunTime: Date | null = null;
let intervalId: NodeJS.Timeout | null = null;

/**
 * Run the dynamic pricing optimization
 */
async function runPricingOptimization(): Promise<void> {
  if (isRunning) {
    console.log('[DynamicPricingListener] Already running, skipping...');
    return;
  }

  isRunning = true;
  console.log('[DynamicPricingListener] 🔄 Starting scheduled pricing optimization...');

  try {
    const collectionName = process.env.FIRESTORE_JOBS_COLLECTION || 'products';
    const { recommendations, results } = await runDynamicPricing(collectionName);

    lastRunTime = new Date();
    
    console.log('[DynamicPricingListener] ✅ Pricing optimization complete:');
    console.log(`  - Recommendations: ${recommendations.length}`);
    console.log(`  - Applied: ${results.applied}`);
    console.log(`  - Skipped: ${results.skipped}`);
    console.log(`  - Failed: ${results.failed}`);
    console.log(`  - Next run: ${new Date(Date.now() + INTERVAL_MS).toISOString()}`);
  } catch (error: any) {
    console.error('[DynamicPricingListener] ❌ Pricing optimization failed:', error.message);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the dynamic pricing listener
 * Runs immediately then on the configured interval
 */
export function startDynamicPricingListener(): void {
  const enabled = process.env.ENABLE_DYNAMIC_PRICING === 'true';

  if (!enabled) {
    console.log('[DynamicPricingListener] ℹ️ Dynamic pricing disabled (ENABLE_DYNAMIC_PRICING !== true)');
    return;
  }

  console.log(`[DynamicPricingListener] 🚀 Starting dynamic pricing listener (interval: ${INTERVAL_DAYS} days)`);

  // Run initial optimization after a short delay (let other systems initialize)
  setTimeout(async () => {
    await runPricingOptimization();
  }, 30000); // 30 second delay on startup

  // Schedule recurring runs
  intervalId = setInterval(async () => {
    await runPricingOptimization();
  }, INTERVAL_MS);

  console.log('[DynamicPricingListener] ✅ Listener started. Next run in 30 seconds, then every ' + INTERVAL_DAYS + ' days.');
}

/**
 * Stop the dynamic pricing listener
 */
export function stopDynamicPricingListener(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[DynamicPricingListener] Stopped');
  }
}

/**
 * Get listener status
 */
export function getDynamicPricingStatus(): {
  enabled: boolean;
  isRunning: boolean;
  lastRunTime: Date | null;
  intervalDays: number;
  nextRunTime: Date | null;
} {
  const enabled = process.env.ENABLE_DYNAMIC_PRICING === 'true';
  
  return {
    enabled,
    isRunning,
    lastRunTime,
    intervalDays: INTERVAL_DAYS,
    nextRunTime: lastRunTime
      ? new Date(lastRunTime.getTime() + INTERVAL_MS)
      : null,
  };
}

/**
 * Manually trigger a pricing optimization run
 */
export async function triggerPricingOptimization(
  dryRun: boolean = false
): Promise<{ success: boolean; message: string }> {
  if (isRunning) {
    return { success: false, message: 'Pricing optimization already running' };
  }

  try {
    const collectionName = process.env.FIRESTORE_JOBS_COLLECTION || 'products';
    const { recommendations, results } = await runDynamicPricing(collectionName, dryRun);

    return {
      success: true,
      message: `${dryRun ? '(DRY RUN) ' : ''}Generated ${recommendations.length} recommendations. Applied: ${results.applied}, Skipped: ${results.skipped}, Failed: ${results.failed}`,
    };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}


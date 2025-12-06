/**
 * Marketing Automation Listener
 * 
 * Scheduled tasks for marketing automation:
 * - Daily SEO audits
 * - Weekly email campaigns
 * - Monthly content generation
 * - Social media posting
 */

import { CronJob } from 'cron';
import {
  optimizeAllProductsSEO,
  generateSitemap,
} from '../../lib/marketing/seo-optimizer.js';
import {
  generateCategoryBlogPosts,
} from '../../lib/marketing/content-generator.js';
import {
  generateAllShareCards,
} from '../../lib/marketing/social-media.js';
import {
  getAllTrafficStrategies,
} from '../../lib/marketing/traffic-generator.js';

const ENABLE_MARKETING_AUTOMATION = process.env.ENABLE_MARKETING_AUTOMATION === 'true';

/**
 * Daily SEO audit and optimization
 */
async function runDailySEOAudit(): Promise<void> {
  if (!ENABLE_MARKETING_AUTOMATION) {
    console.log('[Marketing] Automation disabled, skipping SEO audit');
    return;
  }

  console.log('[Marketing] 🔍 Running daily SEO audit...');
  try {
    const result = await optimizeAllProductsSEO();
    console.log(`[Marketing] ✅ SEO audit complete: ${result.optimized} optimized, ${result.failed} failed`);
    
    // Generate/update sitemap
    try {
      await generateSitemap();
      console.log('[Marketing] ✅ Sitemap generated');
    } catch (error: any) {
      console.error('[Marketing] Failed to generate sitemap:', error.message);
    }
  } catch (error: any) {
    console.error('[Marketing] SEO audit failed:', error.message);
  }
}

/**
 * Weekly content generation
 */
async function runWeeklyContentGeneration(): Promise<void> {
  if (!ENABLE_MARKETING_AUTOMATION) {
    console.log('[Marketing] Automation disabled, skipping content generation');
    return;
  }

  console.log('[Marketing] ✍️ Running weekly content generation...');
  try {
    const posts = await generateCategoryBlogPosts();
    console.log(`[Marketing] ✅ Generated ${posts.length} blog posts`);
  } catch (error: any) {
    console.error('[Marketing] Content generation failed:', error.message);
  }
}

/**
 * Monthly social media updates
 */
async function runMonthlySocialUpdates(): Promise<void> {
  if (!ENABLE_MARKETING_AUTOMATION) {
    console.log('[Marketing] Automation disabled, skipping social updates');
    return;
  }

  console.log('[Marketing] 📱 Running monthly social media updates...');
  try {
    const result = await generateAllShareCards();
    console.log(`[Marketing] ✅ Generated ${result.generated} share cards`);
  } catch (error: any) {
    console.error('[Marketing] Social updates failed:', error.message);
  }
}

/**
 * Weekly traffic strategy analysis
 */
async function runWeeklyTrafficAnalysis(): Promise<void> {
  if (!ENABLE_MARKETING_AUTOMATION) {
    console.log('[Marketing] Automation disabled, skipping traffic analysis');
    return;
  }

  console.log('[Marketing] 🚀 Running weekly traffic strategy analysis...');
  try {
    const strategies = await getAllTrafficStrategies();
    console.log(`[Marketing] ✅ Identified ${strategies.length} traffic strategies`);
    
    // Log strategies for review
    strategies.forEach((strategy, index) => {
      console.log(`[Marketing]   ${index + 1}. ${strategy.title} (${strategy.type})`);
    });
  } catch (error: any) {
    console.error('[Marketing] Traffic analysis failed:', error.message);
  }
}

/**
 * Start marketing automation listener
 */
export function startMarketingListener(): void {
  if (!ENABLE_MARKETING_AUTOMATION) {
    console.log('[Marketing] ⚠️ Marketing automation is disabled');
    console.log('[Marketing] Set ENABLE_MARKETING_AUTOMATION=true to enable');
    return;
  }

  console.log('[Marketing] 🚀 Starting marketing automation listener...');

  // Daily SEO audit at 2 AM
  const dailySEOJob = new CronJob('0 2 * * *', runDailySEOAudit, null, true, 'America/New_York');
  console.log('[Marketing] ✅ Daily SEO audit scheduled (2 AM daily)');

  // Weekly content generation on Mondays at 9 AM
  const weeklyContentJob = new CronJob('0 9 * * 1', runWeeklyContentGeneration, null, true, 'America/New_York');
  console.log('[Marketing] ✅ Weekly content generation scheduled (Mondays 9 AM)');

  // Monthly social updates on 1st of month at 10 AM
  const monthlySocialJob = new CronJob('0 10 1 * *', runMonthlySocialUpdates, null, true, 'America/New_York');
  console.log('[Marketing] ✅ Monthly social updates scheduled (1st of month 10 AM)');

  // Weekly traffic analysis on Fridays at 3 PM
  const weeklyTrafficJob = new CronJob('0 15 * * 5', runWeeklyTrafficAnalysis, null, true, 'America/New_York');
  console.log('[Marketing] ✅ Weekly traffic analysis scheduled (Fridays 3 PM)');

  // Run initial SEO audit on startup
  runDailySEOAudit().catch(error => {
    console.error('[Marketing] Initial SEO audit failed:', error);
  });

  console.log('[Marketing] ✅ Marketing automation listener is active');
}


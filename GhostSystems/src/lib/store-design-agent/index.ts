/**
 * Store Design Agent - Main Entry Point
 * 
 * Autonomous AI agent for continuous store design optimization.
 */

export * from './types.js';
export * from './analytics.js';
export * from './designer.js';
export * from './approval-queue.js';
export * from './notifications.js';
export * from './theme-modifier.js';
export * from './brand-analyzer.js';
export * from './theme-settings.js';

import { collectStoreAnalytics } from './analytics.js';
import { generateRecommendations } from './designer.js';
import {
  saveRecommendations,
  saveAnalyticsSnapshot,
  getPreviousAnalytics,
  getPendingRecommendations,
  getRecommendation,
  approveRecommendation,
  rejectRecommendation,
  markAsApplied,
  getRecommendationStats,
} from './approval-queue.js';
import { sendRecommendationEmail } from './notifications.js';
import { applyRecommendation, revertChange, previewChange } from './theme-modifier.js';
import { getBrandProfile } from './brand-analyzer.js';
import { getDracanusBrandProfile } from './dracanus-brand.js';
import { applyThemeSettings, applyDracanusThemeAuto } from './theme-settings.js';
import { DesignRecommendation } from './types.js';

/**
 * Run the design agent - collect analytics, generate recommendations, notify
 */
export async function runDesignAgent(): Promise<{
  success: boolean;
  recommendations: number;
  error?: string;
}> {
  console.log('[DesignAgent] 🚀 Starting design agent run...');
  lastRunTime = new Date();

  try {
    // 0. Analyze brand and apply theme settings automatically
    console.log('[DesignAgent] 🎨 Analyzing brand and applying theme...');
    
    // Use pre-configured DRACANUS brand profile for faster setup
    const dracanusProfile = getDracanusBrandProfile();
    
    // Try to get logo from Shopify, but use DRACANUS profile as base
    const shopifyBrand = await getBrandProfile();
    const brandProfile = shopifyBrand || dracanusProfile;
    
    // Merge any logo-specific findings with DRACANUS defaults
    if (shopifyBrand && shopifyBrand.logoUrl) {
      console.log('[DesignAgent] Logo found, using brand analysis + DRACANUS defaults');
      // Merge colors if logo analysis found different ones
      brandProfile.colors = { ...dracanusProfile.colors, ...shopifyBrand.colors };
    } else {
      console.log('[DesignAgent] Using pre-configured DRACANUS brand profile');
    }
    
    // Apply theme settings (colors, fonts) based on brand profile
    await applyThemeSettings(brandProfile);
    console.log('[DesignAgent] ✅ DRACANUS theme settings applied');

    // 1. Collect store analytics
    const analytics = await collectStoreAnalytics();
    if (!analytics) {
      return { success: false, recommendations: 0, error: 'Failed to collect analytics' };
    }

    // Save analytics snapshot for historical comparison
    await saveAnalyticsSnapshot(analytics);

    // 2. Generate recommendations based on analytics
    const minConfidence = parseFloat(process.env.DESIGN_AGENT_MIN_CONFIDENCE || '0.7');
    const autoApply = process.env.DESIGN_AGENT_AUTO_APPLY === 'true';
    const maxDailyChanges = parseInt(process.env.DESIGN_AGENT_MAX_DAILY_CHANGES || '5', 10);
    
    const recommendations = await generateRecommendations(analytics, minConfidence);
    
    // Prioritize recommendations by impact and confidence
    const prioritized = recommendations.sort((a, b) => {
      // High priority first
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      // Then by estimated impact
      if (a.metrics.estimatedImpact !== b.metrics.estimatedImpact) {
        return b.metrics.estimatedImpact - a.metrics.estimatedImpact;
      }
      // Finally by confidence
      return b.metrics.confidence - a.metrics.confidence;
    });

    if (recommendations.length === 0) {
      console.log('[DesignAgent] No recommendations generated (all filtered or none needed)');
      return { success: true, recommendations: 0 };
    }

    // 3. Save recommendations to Firebase
    const savedIds = await saveRecommendations(recommendations);

    // 5. Send email notification (only for non-auto-applied recommendations)
    if (recommendationsToSave.length > 0) {
      await sendRecommendationEmail(recommendationsToSave);
    }
    
    if (autoApplied > 0) {
      console.log(`[DesignAgent] 🤖 Auto-applied ${autoApplied} high-confidence recommendations`);
    }

    // 5. Auto-generate images for products with placeholders
    const autoGenerateImages = process.env.DESIGN_AGENT_AUTO_GENERATE_IMAGES !== 'false'; // Default: true
    if (autoGenerateImages) {
      console.log('[DesignAgent] 🖼️ Auto-generating images for products with placeholders...');
      try {
        const { fetchProducts, updateProduct } = await import('../shopify.js');
        const { generateProductImage } = await import('../gemini.js');
        
        const products = await fetchProducts();
        const productsNeedingImages = products.filter((p: any) => {
          if (!p.images || p.images.length === 0) return true;
          
          // Check all images, not just the first one
          const hasPlaceholder = p.images.some((img: any) => {
            const src = (img.src || '').toLowerCase();
            if (!src) return false;
            
            // Use URL parsing for proper hostname checking (more secure than substring matching)
            try {
              const url = new URL(src);
              const hostname = url.hostname.toLowerCase();
              
              // Check hostname for placeholder services
              if (hostname.includes('placeholder.com') || 
                  hostname.includes('picsum.photos') ||
                  hostname.includes('unsplash.com') ||
                  hostname.includes('via.placeholder')) {
                return true;
              }
            } catch {
              // If URL parsing fails, fall back to pattern matching on the full URL
              // This is safe because we're only checking for known placeholder patterns
            }
            
            // Check for placeholder patterns in path/query
            return (
              src.includes('placeholder') ||
              src.includes('picsum') ||
              src.includes('unsplash') ||
              src.includes('lorem') ||
              src.includes('seed=') ||
              src.includes('nature') ||
              src.includes('no-image') ||
              src.includes('gift-card') ||
              // Check for common placeholder patterns
              src.match(/\/\d+\/\d+/) || // Pattern like /800/800 (picsum)
              src.includes('random')
            );
          });
          
          return hasPlaceholder;
        });

        if (productsNeedingImages.length > 0) {
          console.log(`[DesignAgent] Found ${productsNeedingImages.length} products needing AI images`);
          
          // Generate images for first 10 products (to avoid rate limits)
          const productsToProcess = productsNeedingImages.slice(0, 10);
          let generated = 0;
          
          const { getDracanusImagePrompt } = await import('./dracanus-brand.js');
          
          for (const product of productsToProcess) {
            try {
              console.log(`[DesignAgent] Generating DRACANUS-branded image for: ${product.title}`);
              
              // Use DRACANUS-optimized prompt for faster, brand-aligned generation
              const customPrompt = getDracanusImagePrompt(product.title, product.product_type || 'digital');
              const imageResult = await generateProductImage(product.title, product.product_type || 'digital', customPrompt);
              
              if (imageResult.base64) {
                // Replace images - delete placeholders and set DRACANUS as primary
                const { replaceProductImages } = await import('../shopify.js');
                await replaceProductImages(String(product.id), imageResult.base64, true);
                generated++;
                console.log(`[DesignAgent] ✅ Replaced placeholder with DRACANUS image for: ${product.title}`);
              }
              
              // Rate limiting - wait 2 seconds between images
              await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error: any) {
              console.warn(`[DesignAgent] Failed to generate image for ${product.title}:`, error.message);
            }
          }
          
          console.log(`[DesignAgent] ✅ Generated ${generated} AI images`);
        } else {
          console.log('[DesignAgent] All products already have images');
        }
      } catch (error: any) {
        console.warn('[DesignAgent] Image generation failed:', error.message);
      }
    }

    // 6. Auto-apply if configured
    const autoApply = process.env.DESIGN_AGENT_AUTO_APPLY === 'true';
    if (autoApply) {
      console.log('[DesignAgent] Auto-apply enabled, applying high-confidence recommendations...');
      const highConfidence = recommendations.filter((r) => r.metrics.confidence >= 0.9);
      for (const rec of highConfidence.slice(0, 3)) { // Max 3 auto-applies
        await processApproval(rec.id);
      }
    }

    console.log(`[DesignAgent] ✅ Run complete. ${recommendations.length} recommendations generated.`);
    return { success: true, recommendations: recommendations.length };
  } catch (error: any) {
    console.error('[DesignAgent] ❌ Run failed:', error.message);
    return { success: false, recommendations: 0, error: error.message };
  }
}

/**
 * Process an approval - apply the recommendation
 */
export async function processApproval(
  recommendationId: string
): Promise<{ success: boolean; error?: string }> {
  const recommendation = await getRecommendation(recommendationId);
  if (!recommendation) {
    return { success: false, error: 'Recommendation not found' };
  }

  // Mark as approved
  await approveRecommendation(recommendationId);

  // Apply the change
  const result = await applyRecommendation(recommendation);
  
  if (result.success) {
    await markAsApplied(recommendationId);
    return { success: true };
  } else {
    return { success: false, error: result.error };
  }
}

/**
 * Process a rejection
 */
export async function processRejection(
  recommendationId: string,
  reason?: string
): Promise<{ success: boolean }> {
  await rejectRecommendation(recommendationId, reason);
  return { success: true };
}

/**
 * Get preview of a recommendation
 */
export async function getPreview(
  recommendationId: string
): Promise<{ before: string; after: string; affectedFiles: string[] } | null> {
  const recommendation = await getRecommendation(recommendationId);
  if (!recommendation) return null;

  return previewChange(recommendation);
}

/**
 * Revert a previously applied recommendation
 */
export async function processRevert(
  backupId: string
): Promise<{ success: boolean; error?: string }> {
  return revertChange(backupId);
}

// Track last run time
let lastRunTime: Date | null = null;

/**
 * Get agent status and statistics
 */
export async function getAgentStatus(): Promise<{
  enabled: boolean;
  lastRun: string | null;
  totalRecommendations: number;
  pendingRecommendations: number;
  approvedRecommendations: number;
  rejectedRecommendations: number;
  appliedRecommendations: number;
  successRate: number;
  averageConfidence: number;
  topRecommendationTypes: Array<{ type: string; count: number; approvalRate: number }>;
  recentActivity: Array<{ date: string; action: string; count: number }>;
}> {
  const enabled = process.env.ENABLE_STORE_DESIGN_AGENT === 'true';
  
  const pending = await getPendingRecommendations();
  const stats = await getRecommendationStats();
  
  // Calculate success rate
  const totalDecisions = stats.approved + stats.rejected;
  const successRate = totalDecisions > 0 ? (stats.approved / totalDecisions) * 100 : 0;
  
  // Get recommendation type breakdown
  const { getFirestore } = await import('firebase-admin/firestore');
  const db = getFirestore();
  const allRecs = await db.collection('store_design_recommendations')
    .limit(100)
    .get();
  
  const typeStats: Record<string, { count: number; approved: number; rejected: number }> = {};
  let totalConfidence = 0;
  let confidenceCount = 0;
  
  allRecs.docs.forEach(doc => {
    const rec = doc.data() as DesignRecommendation;
    const type = rec.type;
    
    if (!typeStats[type]) {
      typeStats[type] = { count: 0, approved: 0, rejected: 0 };
    }
    
    typeStats[type].count++;
    if (rec.status === 'approved') typeStats[type].approved++;
    if (rec.status === 'rejected') typeStats[type].rejected++;
    
    if (rec.metrics?.confidence) {
      totalConfidence += rec.metrics.confidence;
      confidenceCount++;
    }
  });
  
  const topRecommendationTypes = Object.entries(typeStats)
    .map(([type, stats]) => ({
      type,
      count: stats.count,
      approvalRate: (stats.approved + stats.rejected) > 0 
        ? (stats.approved / (stats.approved + stats.rejected)) * 100 
        : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  const averageConfidence = confidenceCount > 0 ? (totalConfidence / confidenceCount) * 100 : 0;
  
  // Get recent activity (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const recentRecs = await db.collection('store_design_recommendations')
    .where('createdAt', '>=', sevenDaysAgo)
    .get();
  
  const activityByDate: Record<string, { approved: number; rejected: number; applied: number }> = {};
  recentRecs.docs.forEach(doc => {
    const rec = doc.data() as DesignRecommendation;
    const date = rec.createdAt?.toDate?.()?.toISOString().split('T')[0] || 
                 (rec.createdAt instanceof Date ? rec.createdAt.toISOString().split('T')[0] : '');
    
    if (!date) return;
    
    if (!activityByDate[date]) {
      activityByDate[date] = { approved: 0, rejected: 0, applied: 0 };
    }
    
    if (rec.status === 'approved') activityByDate[date].approved++;
    if (rec.status === 'rejected') activityByDate[date].rejected++;
    if (rec.status === 'applied') activityByDate[date].applied++;
  });
  
  const recentActivity = Object.entries(activityByDate)
    .map(([date, counts]) => ({
      date,
      action: 'recommendations',
      count: counts.approved + counts.rejected + counts.applied,
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);
  
  return {
    enabled,
    lastRun: lastRunTime?.toISOString() || null,
    totalRecommendations: stats.total,
    pendingRecommendations: pending.length,
    approvedRecommendations: stats.approved,
    rejectedRecommendations: stats.rejected,
    appliedRecommendations: stats.applied,
    successRate: Math.round(successRate * 10) / 10,
    averageConfidence: Math.round(averageConfidence * 10) / 10,
    topRecommendationTypes,
    recentActivity,
  };
}


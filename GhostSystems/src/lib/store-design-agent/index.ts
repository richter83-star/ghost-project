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
    const recommendations = await generateRecommendations(analytics, minConfidence);

    if (recommendations.length === 0) {
      console.log('[DesignAgent] No recommendations generated (all filtered or none needed)');
      return { success: true, recommendations: 0 };
    }

    // 3. Save recommendations to Firebase
    const savedIds = await saveRecommendations(recommendations);

    // 4. Send email notification
    await sendRecommendationEmail(recommendations);

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
          const src = p.images[0]?.src || '';
          return src.includes('placeholder') || src.includes('picsum') || src.includes('no-image');
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
                await updateProduct(String(product.id), {
                  images: [{ attachment: imageResult.base64 }],
                });
                generated++;
                console.log(`[DesignAgent] ✅ Generated DRACANUS image for: ${product.title}`);
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

/**
 * Get agent status and statistics
 */
export async function getAgentStatus(): Promise<{
  enabled: boolean;
  lastRun: Date | null;
  stats: {
    pending: number;
    approved: number;
    applied: number;
    rejected: number;
    avgImpact: number;
  };
}> {
  const enabled = process.env.ENABLE_STORE_DESIGN_AGENT === 'true';
  const stats = await getRecommendationStats();

  return {
    enabled,
    lastRun: null, // TODO: Track last run time
    stats,
  };
}


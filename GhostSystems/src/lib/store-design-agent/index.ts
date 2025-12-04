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

    // 5. Auto-apply if configured
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


/**
 * Marketing Agent - Main Entry Point
 * 
 * Autonomous AI agent for continuous marketing optimization.
 */

export * from './types.js';
export * from './analytics.js';
export * from './strategy-generator.js';
export * from './approval-queue.js';
export * from './campaign-executor.js';
export * from './learning.js';
export * from './credentials.js';
export * from './social-poster.js';
export * from './blog-publisher.js';

import { collectMarketingAnalytics, saveAnalyticsSnapshot, getPreviousAnalytics } from './analytics.js';
import { generateMarketingStrategies } from './strategy-generator.js';
import {
  saveRecommendations,
  getPendingRecommendations,
  getApprovedRecommendations,
  getRecommendationStats,
  getRecommendation,
  approveRecommendation,
  rejectRecommendation,
} from './approval-queue.js';
import { sendRecommendationEmail } from './notifications.js';
import { executeCampaign } from './campaign-executor.js';
import { applyLearningToRecommendations } from './learning.js';
import { MarketingAnalytics, MarketingRecommendation } from './types.js';

// Track last run time
let lastRunTime: Date | null = null;

/**
 * Run the marketing agent - collect analytics, generate recommendations, execute campaigns
 */
export async function runMarketingAgent(): Promise<{
  success: boolean;
  recommendations: number;
  campaignsExecuted: number;
  error?: string;
}> {
  console.log('[MarketingAgent] 🚀 Starting marketing agent run...');
  lastRunTime = new Date();

  try {
    // 1. Collect marketing analytics
    const analytics = await collectMarketingAnalytics();
    if (!analytics) {
      return { success: false, recommendations: 0, campaignsExecuted: 0, error: 'Failed to collect analytics' };
    }

    // Save analytics snapshot for historical comparison
    await saveAnalyticsSnapshot(analytics);

    // Get previous analytics for trend analysis
    const previousAnalytics = await getPreviousAnalytics(7);

    // 2. Generate marketing strategy recommendations
    const minConfidence = parseFloat(process.env.MARKETING_AGENT_MIN_CONFIDENCE || '0.75');
    const autoExecute = process.env.MARKETING_AGENT_AUTO_EXECUTE === 'true';
    const maxDailyCampaigns = parseInt(process.env.MARKETING_AGENT_MAX_DAILY_CAMPAIGNS || '3', 10);
    
    let recommendations = await generateMarketingStrategies(analytics, previousAnalytics, minConfidence);
    
    // Apply learning from past performance
    recommendations = await applyLearningToRecommendations(recommendations);
    
    // Prioritize recommendations
    const prioritized = recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      if (a.metrics.expectedImpact !== b.metrics.expectedImpact) {
        return b.metrics.expectedImpact - a.metrics.expectedImpact;
      }
      return b.metrics.confidence - a.metrics.confidence;
    });

    if (prioritized.length === 0) {
      console.log('[MarketingAgent] No recommendations generated (all filtered or none needed)');
      return { success: true, recommendations: 0, campaignsExecuted: 0 };
    }

    // 3. Auto-execute high-confidence campaigns if enabled
    let campaignsExecuted = 0;
    if (autoExecute) {
      const highConfidenceRecs = prioritized.filter(r => 
        r.metrics.confidence >= 0.9 && 
        r.priority === 'high' && 
        r.metrics.expectedImpact > 10
      ).slice(0, maxDailyCampaigns);
      
      for (const rec of highConfidenceRecs) {
        try {
          const result = await executeCampaign(rec);
          if (result.success) {
            campaignsExecuted++;
            console.log(`[MarketingAgent] ✅ Auto-executed: ${rec.title}`);
          }
        } catch (error: any) {
          console.error(`[MarketingAgent] ❌ Failed to auto-execute ${rec.id}:`, error.message);
        }
      }
    }

    // 4. Save remaining recommendations to Firebase
    const recommendationsToSave = autoExecute ? prioritized.slice(campaignsExecuted) : prioritized;
    const savedIds = await saveRecommendations(recommendationsToSave);

    // 5. Send email notification (only for non-auto-executed recommendations)
    if (recommendationsToSave.length > 0) {
      await sendRecommendationEmail(recommendationsToSave);
    }
    
    if (campaignsExecuted > 0) {
      console.log(`[MarketingAgent] 🤖 Auto-executed ${campaignsExecuted} high-confidence campaigns`);
    }

    // 6. Execute any approved campaigns that are pending
    const approvedRecs = await getApprovedRecommendations();
    for (const rec of approvedRecs.slice(0, maxDailyCampaigns - campaignsExecuted)) {
      try {
        const result = await executeCampaign(rec);
        if (result.success) {
          campaignsExecuted++;
          console.log(`[MarketingAgent] ✅ Executed approved campaign: ${rec.title}`);
        }
      } catch (error: any) {
        console.error(`[MarketingAgent] ❌ Failed to execute ${rec.id}:`, error.message);
      }
    }

    console.log(`[MarketingAgent] ✅ Marketing agent run complete: ${recommendationsToSave.length} recommendations, ${campaignsExecuted} campaigns executed`);

    return {
      success: true,
      recommendations: recommendationsToSave.length,
      campaignsExecuted,
    };
  } catch (error: any) {
    console.error('[MarketingAgent] ❌ Marketing agent run failed:', error.message);
    return {
      success: false,
      recommendations: 0,
      campaignsExecuted: 0,
      error: error.message,
    };
  }
}

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
  completedRecommendations: number;
  activeCampaigns: number;
  successRate: number;
  averageConfidence: number;
  topStrategyTypes: Array<{ type: string; count: number; approvalRate: number }>;
}> {
  const enabled = process.env.ENABLE_MARKETING_AGENT === 'true';
  
  const pending = await getPendingRecommendations();
  const stats = await getRecommendationStats();
  const { getActiveCampaigns } = await import('./campaign-executor.js');
  const activeCampaigns = await getActiveCampaigns();
  
  // Calculate success rate
  const totalDecisions = stats.approved + stats.rejected;
  const successRate = totalDecisions > 0 ? (stats.approved / totalDecisions) * 100 : 0;
  
  // Get recommendation type breakdown
  const { getFirestore } = await import('firebase-admin/firestore');
  const db = getFirestore();
  const allRecs = await db.collection('marketing_recommendations')
    .limit(100)
    .get();
  
  const typeStats: Record<string, { count: number; approved: number; rejected: number }> = {};
  let totalConfidence = 0;
  let confidenceCount = 0;
  
  allRecs.docs.forEach(doc => {
    const rec = doc.data() as MarketingRecommendation;
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
  
  const topStrategyTypes = Object.entries(typeStats)
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
  
  return {
    enabled,
    lastRun: lastRunTime?.toISOString() || null,
    totalRecommendations: stats.total,
    pendingRecommendations: pending.length,
    approvedRecommendations: stats.approved,
    rejectedRecommendations: stats.rejected,
    completedRecommendations: stats.completed,
    activeCampaigns: activeCampaigns.length,
    successRate: Math.round(successRate * 10) / 10,
    averageConfidence: Math.round(averageConfidence * 10) / 10,
    topStrategyTypes,
  };
}


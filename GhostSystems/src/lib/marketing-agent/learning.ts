/**
 * Marketing Agent - Learning System
 * 
 * Tracks campaign performance and learns from results to improve future recommendations
 */

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { MarketingRecommendation } from './types.js';

const LEARNING_COLLECTION = 'marketing_agent_learning';

/**
 * Record approval/rejection for learning
 */
export async function recordMarketingDecision(
  recommendationId: string,
  decision: 'approved' | 'rejected',
  reason?: string
): Promise<void> {
  const db = getFirestore();
  
  try {
    // Get the recommendation to learn from its type
    const recDoc = await db.collection('marketing_recommendations').doc(recommendationId).get();
    if (!recDoc.exists) {
      return;
    }

    const rec = recDoc.data() as MarketingRecommendation;
    const type = rec.type;

    // Update learning data
    const learningRef = db.collection(LEARNING_COLLECTION).doc('patterns');
    const learningDoc = await learningRef.get();

    const currentData = learningDoc.exists ? learningDoc.data() : {
      approvalRates: {},
      rejectionReasons: {},
      typePreferences: {},
      totalDecisions: 0,
    };

    // Update approval rates
    const approvalRates = currentData.approvalRates || {};
    const typeStats = approvalRates[type] || { approved: 0, rejected: 0 };
    
    if (decision === 'approved') {
      typeStats.approved++;
    } else {
      typeStats.rejected++;
    }
    
    approvalRates[type] = typeStats;
    const approvalRate = typeStats.approved / (typeStats.approved + typeStats.rejected);

    // Update rejection reasons
    if (decision === 'rejected' && reason) {
      const rejectionReasons = currentData.rejectionReasons || {};
      if (!rejectionReasons[type]) {
        rejectionReasons[type] = [];
      }
      rejectionReasons[type].push(reason);
      // Keep only last 10 reasons per type
      if (rejectionReasons[type].length > 10) {
        rejectionReasons[type] = rejectionReasons[type].slice(-10);
      }
    }

    // Update type preferences (higher = more preferred)
    const typePreferences = currentData.typePreferences || {};
    if (decision === 'approved') {
      typePreferences[type] = (typePreferences[type] || 1.0) + 0.1; // Increase preference
    } else {
      typePreferences[type] = Math.max(0.5, (typePreferences[type] || 1.0) - 0.1); // Decrease preference
    }

    // Save updated learning data
    await learningRef.set({
      approvalRates,
      rejectionReasons,
      typePreferences,
      totalDecisions: (currentData.totalDecisions || 0) + 1,
      lastUpdated: FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`[MarketingAgent] 📚 Recorded ${decision} for ${type} (approval rate: ${(approvalRate * 100).toFixed(1)}%)`);
  } catch (error: any) {
    console.error('[MarketingAgent] Failed to record decision:', error.message);
  }
}

/**
 * Record campaign performance results
 */
export async function recordCampaignPerformance(
  recommendationId: string,
  actualResults: {
    traffic?: number;
    conversions?: number;
    revenue?: number;
    opens?: number;
    clicks?: number;
  },
  expectedResults: {
    traffic?: number;
    conversions?: number;
    revenue?: number;
  }
): Promise<void> {
  const db = getFirestore();
  
  try {
    // Get the recommendation
    const recDoc = await db.collection('marketing_recommendations').doc(recommendationId).get();
    if (!recDoc.exists) {
      return;
    }

    const rec = recDoc.data() as MarketingRecommendation;
    const type = rec.type;

    // Calculate performance vs expected
    const performanceVsExpected: Record<string, number> = {};
    if (actualResults.traffic && expectedResults.traffic) {
      performanceVsExpected.traffic = ((actualResults.traffic - expectedResults.traffic) / expectedResults.traffic) * 100;
    }
    if (actualResults.conversions && expectedResults.conversions) {
      performanceVsExpected.conversions = ((actualResults.conversions - expectedResults.conversions) / expectedResults.conversions) * 100;
    }
    if (actualResults.revenue && expectedResults.revenue) {
      performanceVsExpected.revenue = ((actualResults.revenue - expectedResults.revenue) / expectedResults.revenue) * 100;
    }

    // Calculate ROI
    const roi = actualResults.revenue && rec.metrics.expectedRevenue
      ? ((actualResults.revenue - rec.metrics.expectedRevenue) / rec.metrics.expectedRevenue) * 100
      : 0;

    // Update recommendation with results
    await db.collection('marketing_recommendations').doc(recommendationId).update({
      results: {
        actualTraffic: actualResults.traffic,
        actualConversions: actualResults.conversions,
        actualRevenue: actualResults.revenue,
        roi,
        performanceVsExpected: performanceVsExpected.revenue || 0,
        measurementPeriod: 7, // 7 days
      },
    });

    // Update learning data with performance
    const learningRef = db.collection(LEARNING_COLLECTION).doc('performance');
    const learningDoc = await learningRef.get();

    const currentData = learningDoc.exists ? learningDoc.data() : {
      typePerformance: {},
      totalCampaigns: 0,
    };

    const typePerformance = currentData.typePerformance || {};
    if (!typePerformance[type]) {
      typePerformance[type] = {
        campaigns: 0,
        totalRevenue: 0,
        totalROI: 0,
        avgPerformanceVsExpected: 0,
        successfulCampaigns: 0,
      };
    }

    typePerformance[type].campaigns++;
    typePerformance[type].totalRevenue += actualResults.revenue || 0;
    typePerformance[type].totalROI += roi;
    typePerformance[type].avgPerformanceVsExpected = 
      (typePerformance[type].avgPerformanceVsExpected * (typePerformance[type].campaigns - 1) + 
       (performanceVsExpected.revenue || 0)) / typePerformance[type].campaigns;
    
    if (roi > 0) {
      typePerformance[type].successfulCampaigns++;
    }

    await learningRef.set({
      typePerformance,
      totalCampaigns: (currentData.totalCampaigns || 0) + 1,
      lastUpdated: FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`[MarketingAgent] 📊 Recorded performance for ${type}: ROI ${roi.toFixed(1)}%, Performance vs Expected: ${(performanceVsExpected.revenue || 0).toFixed(1)}%`);
  } catch (error: any) {
    console.error('[MarketingAgent] Failed to record campaign performance:', error.message);
  }
}

/**
 * Apply learning to recommendations (adjust confidence based on historical performance)
 */
export async function applyLearningToRecommendations(
  recommendations: MarketingRecommendation[]
): Promise<MarketingRecommendation[]> {
  const db = getFirestore();
  
  try {
    // Get learning data
    const learningDoc = await db.collection(LEARNING_COLLECTION).doc('patterns').get();
    if (!learningDoc.exists) {
      return recommendations;
    }

    const learningData = learningDoc.data();
    const approvalRates = learningData?.approvalRates || {};
    const typePreferences = learningData?.typePreferences || {};

    // Get performance data
    const performanceDoc = await db.collection(LEARNING_COLLECTION).doc('performance').get();
    const performanceData = performanceDoc.exists ? performanceDoc.data() : { typePerformance: {} };
    const typePerformance = performanceData.typePerformance || {};

    // Adjust confidence based on historical data
    return recommendations.map(rec => {
      const type = rec.type;
      const approvalRate = approvalRates[type]?.approved / (approvalRates[type]?.approved + approvalRates[type]?.rejected) || 0.5;
      const preferenceScore = typePreferences[type] || 1.0;
      const perf = typePerformance[type];

      // Adjust confidence based on:
      // 1. Approval rate (if often approved, increase confidence)
      // 2. Preference score (if preferred, increase confidence)
      // 3. Historical performance (if performs well, increase confidence)
      const approvalAdjustment = (approvalRate - 0.5) * 0.2; // Max ±10%
      const preferenceAdjustment = (preferenceScore - 1.0) * 0.15; // Max ±7.5%
      const performanceAdjustment = perf && perf.avgPerformanceVsExpected > 0
        ? Math.min(0.1, perf.avgPerformanceVsExpected / 100) // Max +10% if performing well
        : 0;

      const adjustedConfidence = Math.max(0.1, Math.min(0.99,
        rec.metrics.confidence + approvalAdjustment + preferenceAdjustment + performanceAdjustment
      ));

      return {
        ...rec,
        metrics: {
          ...rec.metrics,
          confidence: adjustedConfidence,
          basedOn: [...rec.metrics.basedOn, 'historical_learning'],
        },
      };
    });
  } catch (error: any) {
    console.warn('[MarketingAgent] Failed to apply learning:', error.message);
    return recommendations;
  }
}

/**
 * Get learning insights
 */
export async function getLearningInsights(): Promise<{
  topPerformingTypes: Array<{ type: string; avgROI: number; successRate: number }>;
  approvalRates: Record<string, number>;
  recommendations: string[];
}> {
  const db = getFirestore();
  
  try {
    const [patternsDoc, performanceDoc] = await Promise.all([
      db.collection(LEARNING_COLLECTION).doc('patterns').get(),
      db.collection(LEARNING_COLLECTION).doc('performance').get(),
    ]);

    const patternsData = patternsDoc.exists ? patternsDoc.data() : { approvalRates: {} };
    const performanceData = performanceDoc.exists ? performanceDoc.data() : { typePerformance: {} };

    const approvalRates: Record<string, number> = {};
    Object.entries(patternsData.approvalRates || {}).forEach(([type, stats]: [string, any]) => {
      const total = stats.approved + stats.rejected;
      approvalRates[type] = total > 0 ? (stats.approved / total) * 100 : 0;
    });

    const topPerformingTypes = Object.entries(performanceData.typePerformance || {})
      .map(([type, perf]: [string, any]) => ({
        type,
        avgROI: perf.campaigns > 0 ? perf.totalROI / perf.campaigns : 0,
        successRate: perf.campaigns > 0 ? (perf.successfulCampaigns / perf.campaigns) * 100 : 0,
      }))
      .sort((a, b) => b.avgROI - a.avgROI)
      .slice(0, 5);

    const recommendations: string[] = [];
    topPerformingTypes.forEach(({ type, avgROI }) => {
      if (avgROI > 20) {
        recommendations.push(`Continue focusing on ${type} campaigns - high ROI (${avgROI.toFixed(1)}%)`);
      }
    });

    return {
      topPerformingTypes,
      approvalRates,
      recommendations,
    };
  } catch (error: any) {
    console.error('[MarketingAgent] Failed to get learning insights:', error.message);
    return {
      topPerformingTypes: [],
      approvalRates: {},
      recommendations: [],
    };
  }
}


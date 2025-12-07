/**
 * Store Design Agent - A/B Testing Framework
 * 
 * Manages A/B tests for design recommendations to measure impact and learn what works best.
 */

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { DesignRecommendation } from './types.js';
import { applyRecommendation } from './theme-modifier.js';
import { collectStoreAnalytics } from './analytics.js';

export interface ABTest {
  id: string;
  name: string;
  description: string;
  
  // Test configuration
  recommendationId: string;
  variantA: {
    recommendation: DesignRecommendation;
    appliedAt: Date;
  };
  variantB?: {
    recommendation: DesignRecommendation;
    appliedAt: Date;
  };
  
  // Traffic split
  trafficSplit: number; // 0-1, percentage of traffic to variant B (default 0.5 = 50/50)
  
  // Status
  status: 'draft' | 'running' | 'paused' | 'completed';
  startedAt?: Date;
  endedAt?: Date;
  
  // Results
  results?: {
    variantA: {
      visitors: number;
      conversions: number;
      conversionRate: number;
      revenue: number;
    };
    variantB?: {
      visitors: number;
      conversions: number;
      conversionRate: number;
      revenue: number;
    };
    winner?: 'A' | 'B' | 'tie' | 'insufficient_data';
    confidence: number; // Statistical confidence (0-1)
    improvement: number; // Percentage improvement of winner
  };
  
  // Metadata
  createdAt: Date;
  createdBy: string; // 'design_agent' | 'manual'
}

const COLLECTION_NAME = 'ab_tests';

/**
 * Create a new A/B test
 */
export async function createABTest(
  name: string,
  recommendation: DesignRecommendation,
  variantB?: DesignRecommendation,
  trafficSplit: number = 0.5
): Promise<string> {
  const db = getFirestore();
  
  const test: ABTest = {
    id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    description: `A/B test for: ${recommendation.title}`,
    recommendationId: recommendation.id,
    variantA: {
      recommendation,
      appliedAt: new Date(),
    },
    variantB: variantB ? {
      recommendation: variantB,
      appliedAt: new Date(),
    } : undefined,
    trafficSplit: Math.max(0, Math.min(1, trafficSplit)), // Clamp between 0 and 1
    status: 'draft',
    createdAt: new Date(),
    createdBy: 'design_agent',
  };

  await db.collection(COLLECTION_NAME).doc(test.id).set({
    ...test,
    variantA: {
      ...test.variantA,
      appliedAt: test.variantA.appliedAt.toISOString(),
    },
    variantB: test.variantB ? {
      ...test.variantB,
      appliedAt: test.variantB.appliedAt.toISOString(),
    } : undefined,
    createdAt: test.createdAt.toISOString(),
  });

  console.log(`[ABTesting] ✅ Created A/B test: ${test.id} - ${name}`);
  return test.id;
}

/**
 * Start an A/B test
 */
export async function startABTest(testId: string): Promise<boolean> {
  const db = getFirestore();
  
  try {
    const testDoc = await db.collection(COLLECTION_NAME).doc(testId).get();
    if (!testDoc.exists) {
      throw new Error(`A/B test ${testId} not found`);
    }

    const test = testDoc.data() as ABTest;
    if (test.status !== 'draft') {
      throw new Error(`Cannot start test in status: ${test.status}`);
    }

    // Apply variant A (control)
    console.log(`[ABTesting] Applying variant A for test: ${testId}`);
    const resultA = await applyRecommendation(test.variantA.recommendation);
    
    if (!resultA.success) {
      throw new Error(`Failed to apply variant A: ${resultA.error}`);
    }

    // Apply variant B if provided
    if (test.variantB) {
      console.log(`[ABTesting] Applying variant B for test: ${testId}`);
      const resultB = await applyRecommendation(test.variantB.recommendation);
      
      if (!resultB.success) {
        console.warn(`[ABTesting] ⚠️ Failed to apply variant B, continuing with variant A only`);
      }
    }

    // Update test status
    await db.collection(COLLECTION_NAME).doc(testId).update({
      status: 'running',
      startedAt: new Date().toISOString(),
    });

    console.log(`[ABTesting] ✅ Started A/B test: ${testId}`);
    return true;
  } catch (error: any) {
    console.error(`[ABTesting] ❌ Failed to start test ${testId}:`, error.message);
    return false;
  }
}

/**
 * Track a visitor/conversion for an A/B test
 */
export async function trackABTestEvent(
  testId: string,
  variant: 'A' | 'B',
  event: 'visit' | 'conversion',
  value?: number // For revenue tracking
): Promise<void> {
  const db = getFirestore();
  
  try {
    const testDoc = await db.collection(COLLECTION_NAME).doc(testId).get();
    if (!testDoc.exists) {
      return; // Test doesn't exist, ignore
    }

    const test = testDoc.data() as ABTest;
    if (test.status !== 'running') {
      return; // Test not running, ignore
    }

    const updatePath = `results.variant${variant}.${event === 'visit' ? 'visitors' : 'conversions'}`;
    
    await db.collection(COLLECTION_NAME).doc(testId).update({
      [updatePath]: FieldValue.increment(1),
      ...(event === 'conversion' && value ? {
        [`results.variant${variant}.revenue`]: FieldValue.increment(value),
      } : {}),
    });
  } catch (error: any) {
    console.error(`[ABTesting] Failed to track event for test ${testId}:`, error.message);
  }
}

/**
 * Analyze A/B test results and determine winner
 */
export async function analyzeABTest(testId: string): Promise<{
  winner: 'A' | 'B' | 'tie' | 'insufficient_data';
  confidence: number;
  improvement: number;
} | null> {
  const db = getFirestore();
  
  try {
    const testDoc = await db.collection(COLLECTION_NAME).doc(testId).get();
    if (!testDoc.exists) {
      return null;
    }

    const test = testDoc.data() as ABTest;
    if (!test.results) {
      return { winner: 'insufficient_data', confidence: 0, improvement: 0 };
    }

    const variantA = test.results.variantA;
    const variantB = test.results.variantB;

    if (!variantB) {
      // Single variant test - just return variant A stats
      return {
        winner: 'A',
        confidence: variantA.visitors > 100 ? 0.8 : 0.5,
        improvement: 0,
      };
    }

    // Calculate conversion rates
    const rateA = variantA.visitors > 0 ? variantA.conversions / variantA.visitors : 0;
    const rateB = variantB.visitors > 0 ? variantB.conversions / variantB.visitors : 0;

    // Simple statistical test (Z-test approximation)
    // For production, use proper statistical testing library
    const nA = variantA.visitors;
    const nB = variantB.visitors;
    
    if (nA < 30 || nB < 30) {
      return { winner: 'insufficient_data', confidence: 0, improvement: 0 };
    }

    // Calculate pooled proportion
    const p = (variantA.conversions + variantB.conversions) / (nA + nB);
    const se = Math.sqrt(p * (1 - p) * (1/nA + 1/nB));
    
    if (se === 0) {
      return { winner: 'tie', confidence: 0, improvement: 0 };
    }

    // Z-score
    const z = (rateB - rateA) / se;
    
    // Confidence based on Z-score (two-tailed test)
    // Z > 1.96 = 95% confidence, Z > 2.58 = 99% confidence
    let confidence = 0;
    if (Math.abs(z) > 2.58) {
      confidence = 0.99;
    } else if (Math.abs(z) > 1.96) {
      confidence = 0.95;
    } else if (Math.abs(z) > 1.65) {
      confidence = 0.90;
    } else {
      confidence = Math.max(0, Math.abs(z) / 3); // Scale to 0-1
    }

    // Determine winner
    let winner: 'A' | 'B' | 'tie' | 'insufficient_data';
    let improvement = 0;

    if (Math.abs(rateB - rateA) < 0.001) {
      winner = 'tie';
    } else if (rateB > rateA) {
      winner = 'B';
      improvement = ((rateB - rateA) / rateA) * 100;
    } else {
      winner = 'A';
      improvement = ((rateA - rateB) / rateB) * 100;
    }

    // Update test with results
    await db.collection(COLLECTION_NAME).doc(testId).update({
      'results.winner': winner,
      'results.confidence': confidence,
      'results.improvement': improvement,
      'results.variantA.conversionRate': rateA,
      'results.variantB.conversionRate': rateB,
    });

    return { winner, confidence, improvement };
  } catch (error: any) {
    console.error(`[ABTesting] Failed to analyze test ${testId}:`, error.message);
    return null;
  }
}

/**
 * End an A/B test and apply winner
 */
export async function endABTest(
  testId: string,
  applyWinner: boolean = true
): Promise<boolean> {
  const db = getFirestore();
  
  try {
    const testDoc = await db.collection(COLLECTION_NAME).doc(testId).get();
    if (!testDoc.exists) {
      throw new Error(`A/B test ${testId} not found`);
    }

    const test = testDoc.data() as ABTest;
    if (test.status !== 'running') {
      throw new Error(`Cannot end test in status: ${test.status}`);
    }

    // Analyze results
    const analysis = await analyzeABTest(testId);
    
    if (!analysis) {
      throw new Error('Failed to analyze test results');
    }

    // Update test status
    await db.collection(COLLECTION_NAME).doc(testId).update({
      status: 'completed',
      endedAt: new Date().toISOString(),
    });

    console.log(`[ABTesting] ✅ Ended A/B test: ${testId}`);
    console.log(`[ABTesting] 📊 Winner: Variant ${analysis.winner} (${analysis.improvement.toFixed(1)}% improvement, ${(analysis.confidence * 100).toFixed(0)}% confidence)`);

    // Apply winner if requested
    if (applyWinner && analysis.winner !== 'insufficient_data' && analysis.winner !== 'tie') {
      const winningVariant = analysis.winner === 'A' ? test.variantA : test.variantB;
      if (winningVariant) {
        console.log(`[ABTesting] 🎯 Applying winning variant: ${analysis.winner}`);
        await applyRecommendation(winningVariant.recommendation);
      }
    }

    return true;
  } catch (error: any) {
    console.error(`[ABTesting] ❌ Failed to end test ${testId}:`, error.message);
    return false;
  }
}

/**
 * Get all active A/B tests
 */
export async function getActiveABTests(): Promise<ABTest[]> {
  const db = getFirestore();
  
  try {
    const snapshot = await db.collection(COLLECTION_NAME)
      .where('status', '==', 'running')
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        variantA: {
          ...data.variantA,
          appliedAt: new Date(data.variantA.appliedAt),
        },
        variantB: data.variantB ? {
          ...data.variantB,
          appliedAt: new Date(data.variantB.appliedAt),
        } : undefined,
        createdAt: new Date(data.createdAt),
        startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
        endedAt: data.endedAt ? new Date(data.endedAt) : undefined,
      } as ABTest;
    });
  } catch (error: any) {
    console.error('[ABTesting] Failed to get active tests:', error.message);
    return [];
  }
}

/**
 * Get A/B test by ID
 */
export async function getABTest(testId: string): Promise<ABTest | null> {
  const db = getFirestore();
  
  try {
    const doc = await db.collection(COLLECTION_NAME).doc(testId).get();
    if (!doc.exists) {
      return null;
    }

    const data = doc.data()!;
    return {
      ...data,
      variantA: {
        ...data.variantA,
        appliedAt: new Date(data.variantA.appliedAt),
      },
      variantB: data.variantB ? {
        ...data.variantB,
        appliedAt: new Date(data.variantB.appliedAt),
      } : undefined,
      createdAt: new Date(data.createdAt),
      startedAt: data.startedAt ? new Date(data.startedAt) : undefined,
      endedAt: data.endedAt ? new Date(data.endedAt) : undefined,
    } as ABTest;
  } catch (error: any) {
    console.error(`[ABTesting] Failed to get test ${testId}:`, error.message);
    return null;
  }
}


/**
 * Marketing Agent - Approval Queue System
 * 
 * Manages marketing recommendations in Firebase for approval workflow.
 */

import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { MarketingRecommendation, MarketingRecommendationStatus } from './types.js';
import { sendRecommendationEmail } from './notifications.js';

const RECOMMENDATIONS_COLLECTION = 'marketing_recommendations';
const CAMPAIGNS_COLLECTION = 'marketing_campaigns';

let db: FirebaseFirestore.Firestore | null = null;

/**
 * Initialize Firestore
 */
function initFirebase(): boolean {
  if (db) return true;

  try {
    db = getFirestore();
    return true;
  } catch (error: any) {
    console.error('[MarketingAgent] Failed to initialize Firestore:', error.message);
    return false;
  }
}

/**
 * Save a recommendation to the approval queue
 */
export async function saveRecommendation(
  recommendation: MarketingRecommendation
): Promise<string | null> {
  if (!initFirebase() || !db) return null;

  try {
    const docRef = await db.collection(RECOMMENDATIONS_COLLECTION).doc(recommendation.id);
    await docRef.set({
      ...recommendation,
      createdAt: FieldValue.serverTimestamp(),
    });
    console.log(`[MarketingAgent] ✅ Saved recommendation: ${recommendation.title}`);
    return recommendation.id;
  } catch (error: any) {
    console.error('[MarketingAgent] Failed to save recommendation:', error.message);
    return null;
  }
}

/**
 * Save multiple recommendations
 */
export async function saveRecommendations(
  recommendations: MarketingRecommendation[]
): Promise<string[]> {
  if (!initFirebase() || !db) return [];

  const ids: string[] = [];
  const batch = db.batch();

  for (const rec of recommendations) {
    const docRef = db.collection(RECOMMENDATIONS_COLLECTION).doc(rec.id);
    batch.set(docRef, {
      ...rec,
      createdAt: FieldValue.serverTimestamp(),
    });
    ids.push(rec.id);
  }

  try {
    await batch.commit();
    console.log(`[MarketingAgent] ✅ Saved ${ids.length} recommendations`);
    return ids;
  } catch (error: any) {
    console.error('[MarketingAgent] Failed to save recommendations:', error.message);
    return [];
  }
}

/**
 * Get pending recommendations
 */
export async function getPendingRecommendations(): Promise<MarketingRecommendation[]> {
  if (!initFirebase() || !db) return [];

  try {
    const snapshot = await db.collection(RECOMMENDATIONS_COLLECTION)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
        approvedAt: data.approvedAt?.toDate?.() || undefined,
        executedAt: data.executedAt?.toDate?.() || undefined,
        completedAt: data.completedAt?.toDate?.() || undefined,
        rejectedAt: data.rejectedAt?.toDate?.() || undefined,
      } as MarketingRecommendation;
    });
  } catch (error: any) {
    console.error('[MarketingAgent] Failed to get pending recommendations:', error.message);
    return [];
  }
}

/**
 * Get a specific recommendation
 */
export async function getRecommendation(id: string): Promise<MarketingRecommendation | null> {
  if (!initFirebase() || !db) return null;

  try {
    const doc = await db.collection(RECOMMENDATIONS_COLLECTION).doc(id).get();
    if (!doc.exists) return null;

    const data = doc.data()!;
    return {
      ...data,
      createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
      approvedAt: data.approvedAt?.toDate?.() || undefined,
      executedAt: data.executedAt?.toDate?.() || undefined,
      completedAt: data.completedAt?.toDate?.() || undefined,
      rejectedAt: data.rejectedAt?.toDate?.() || undefined,
    } as MarketingRecommendation;
  } catch (error: any) {
    console.error(`[MarketingAgent] Failed to get recommendation ${id}:`, error.message);
    return null;
  }
}

/**
 * Update recommendation status
 */
export async function updateRecommendationStatus(
  id: string,
  status: MarketingRecommendationStatus,
  extra?: { rejectionReason?: string; results?: any }
): Promise<boolean> {
  if (!initFirebase() || !db) return false;

  try {
    const updateData: any = {
      status,
      [`${status}At`]: FieldValue.serverTimestamp(),
    };

    if (extra?.rejectionReason) {
      updateData.rejectionReason = extra.rejectionReason;
    }
    if (extra?.results) {
      updateData.results = extra.results;
    }

    await db.collection(RECOMMENDATIONS_COLLECTION).doc(id).update(updateData);
    console.log(`[MarketingAgent] ✅ Updated recommendation ${id} to ${status}`);
    return true;
  } catch (error: any) {
    console.error('[MarketingAgent] Failed to update recommendation:', error.message);
    return false;
  }
}

/**
 * Approve a recommendation
 */
export async function approveRecommendation(id: string): Promise<boolean> {
  const result = await updateRecommendationStatus(id, 'approved');
  
  // Record approval for learning
  if (result) {
    try {
      const { recordMarketingDecision } = await import('./learning.js');
      await recordMarketingDecision(id, 'approved');
    } catch (error: any) {
      console.warn('[MarketingAgent] Failed to record approval for learning:', error.message);
    }
  }
  
  return result;
}

/**
 * Reject a recommendation
 */
export async function rejectRecommendation(id: string, reason?: string): Promise<boolean> {
  const result = await updateRecommendationStatus(id, 'rejected', { rejectionReason: reason });
  
  // Record rejection for learning
  if (result) {
    try {
      const { recordMarketingDecision } = await import('./learning.js');
      await recordMarketingDecision(id, 'rejected', reason);
    } catch (error: any) {
      console.warn('[MarketingAgent] Failed to record rejection for learning:', error.message);
    }
  }
  
  return result;
}

/**
 * Mark recommendation as executing
 */
export async function markAsExecuting(id: string): Promise<boolean> {
  return updateRecommendationStatus(id, 'executing');
}

/**
 * Mark recommendation as completed
 */
export async function markAsCompleted(id: string, results?: any): Promise<boolean> {
  return updateRecommendationStatus(id, 'completed', { results });
}

/**
 * Get recommendation statistics
 */
export async function getRecommendationStats(): Promise<{
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  executing: number;
  completed: number;
  failed: number;
}> {
  if (!initFirebase() || !db) {
    return { total: 0, pending: 0, approved: 0, rejected: 0, executing: 0, completed: 0, failed: 0 };
  }

  try {
    const snapshot = await db.collection(RECOMMENDATIONS_COLLECTION).get();
    const recommendations = snapshot.docs.map(doc => doc.data());

    return {
      total: recommendations.length,
      pending: recommendations.filter((r: any) => r.status === 'pending').length,
      approved: recommendations.filter((r: any) => r.status === 'approved').length,
      rejected: recommendations.filter((r: any) => r.status === 'rejected').length,
      executing: recommendations.filter((r: any) => r.status === 'executing').length,
      completed: recommendations.filter((r: any) => r.status === 'completed').length,
      failed: recommendations.filter((r: any) => r.status === 'failed').length,
    };
  } catch (error: any) {
    console.error('[MarketingAgent] Failed to get recommendation stats:', error.message);
    return { total: 0, pending: 0, approved: 0, rejected: 0, executing: 0, completed: 0, failed: 0 };
  }
}

/**
 * Get approved recommendations ready for execution
 */
export async function getApprovedRecommendations(): Promise<MarketingRecommendation[]> {
  if (!initFirebase() || !db) return [];

  try {
    const snapshot = await db.collection(RECOMMENDATIONS_COLLECTION)
      .where('status', '==', 'approved')
      .orderBy('approvedAt', 'asc')
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
        approvedAt: data.approvedAt?.toDate?.() || undefined,
      } as MarketingRecommendation;
    });
  } catch (error: any) {
    console.error('[MarketingAgent] Failed to get approved recommendations:', error.message);
    return [];
  }
}


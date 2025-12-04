/**
 * Store Design Agent - Approval Queue System
 * 
 * Manages design recommendations in Firebase for approval workflow.
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { DesignRecommendation, RecommendationStatus, ThemeBackup } from './types.js';

let db: FirebaseFirestore.Firestore | null = null;

const RECOMMENDATIONS_COLLECTION = 'store_design_recommendations';
const BACKUPS_COLLECTION = 'theme_backups';
const ANALYTICS_COLLECTION = 'store_design_analytics';

/**
 * Initialize Firebase
 */
function initFirebase(): boolean {
  if (db) return true;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    console.error('[DesignAgent] FIREBASE_SERVICE_ACCOUNT_JSON not configured');
    return false;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    if (!getApps().length) {
      initializeApp({ credential: cert(serviceAccount as any) });
    }
    db = getFirestore();
    console.log('[DesignAgent] ✅ Firebase initialized for approval queue');
    return true;
  } catch (error: any) {
    console.error('[DesignAgent] Failed to initialize Firebase:', error.message);
    return false;
  }
}

/**
 * Save a recommendation to the approval queue
 */
export async function saveRecommendation(
  recommendation: DesignRecommendation
): Promise<string | null> {
  if (!initFirebase() || !db) return null;

  try {
    const docRef = await db.collection(RECOMMENDATIONS_COLLECTION).add({
      ...recommendation,
      createdAt: FieldValue.serverTimestamp(),
    });
    console.log(`[DesignAgent] ✅ Saved recommendation: ${recommendation.title}`);
    return docRef.id;
  } catch (error: any) {
    console.error('[DesignAgent] Failed to save recommendation:', error.message);
    return null;
  }
}

/**
 * Save multiple recommendations
 */
export async function saveRecommendations(
  recommendations: DesignRecommendation[]
): Promise<string[]> {
  if (!initFirebase() || !db) return [];

  const ids: string[] = [];
  const batch = db.batch();

  for (const rec of recommendations) {
    // Use the recommendation's UUID as the document ID so email links work
    const docRef = db.collection(RECOMMENDATIONS_COLLECTION).doc(rec.id);
    batch.set(docRef, {
      ...rec,
      createdAt: FieldValue.serverTimestamp(),
    });
    ids.push(rec.id);
  }

  try {
    await batch.commit();
    console.log(`[DesignAgent] ✅ Saved ${ids.length} recommendations`);
    return ids;
  } catch (error: any) {
    console.error('[DesignAgent] Failed to save recommendations:', error.message);
    return [];
  }
}

/**
 * Get pending recommendations
 */
export async function getPendingRecommendations(): Promise<DesignRecommendation[]> {
  if (!initFirebase() || !db) return [];

  try {
    const snapshot = await db
      .collection(RECOMMENDATIONS_COLLECTION)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
    })) as DesignRecommendation[];
  } catch (error: any) {
    console.error('[DesignAgent] Failed to get pending recommendations:', error.message);
    return [];
  }
}

/**
 * Get a recommendation by ID
 */
export async function getRecommendation(id: string): Promise<DesignRecommendation | null> {
  if (!initFirebase() || !db) return null;

  try {
    const doc = await db.collection(RECOMMENDATIONS_COLLECTION).doc(id).get();
    if (!doc.exists) return null;

    return {
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data()?.createdAt as Timestamp)?.toDate() || new Date(),
    } as DesignRecommendation;
  } catch (error: any) {
    console.error('[DesignAgent] Failed to get recommendation:', error.message);
    return null;
  }
}

/**
 * Update recommendation status
 */
export async function updateRecommendationStatus(
  id: string,
  status: RecommendationStatus,
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
    console.log(`[DesignAgent] ✅ Updated recommendation ${id} to ${status}`);
    return true;
  } catch (error: any) {
    console.error('[DesignAgent] Failed to update recommendation:', error.message);
    return false;
  }
}

/**
 * Approve a recommendation
 */
export async function approveRecommendation(id: string): Promise<boolean> {
  return updateRecommendationStatus(id, 'approved');
}

/**
 * Reject a recommendation
 */
export async function rejectRecommendation(id: string, reason?: string): Promise<boolean> {
  return updateRecommendationStatus(id, 'rejected', { rejectionReason: reason });
}

/**
 * Mark recommendation as applied
 */
export async function markAsApplied(id: string): Promise<boolean> {
  return updateRecommendationStatus(id, 'applied');
}

/**
 * Save a theme backup
 */
export async function saveThemeBackup(backup: Omit<ThemeBackup, 'id'>): Promise<string | null> {
  if (!initFirebase() || !db) return null;

  try {
    const docRef = await db.collection(BACKUPS_COLLECTION).add({
      ...backup,
      createdAt: FieldValue.serverTimestamp(),
    });
    console.log(`[DesignAgent] ✅ Created theme backup: ${docRef.id}`);
    return docRef.id;
  } catch (error: any) {
    console.error('[DesignAgent] Failed to save backup:', error.message);
    return null;
  }
}

/**
 * Get a theme backup
 */
export async function getThemeBackup(id: string): Promise<ThemeBackup | null> {
  if (!initFirebase() || !db) return null;

  try {
    const doc = await db.collection(BACKUPS_COLLECTION).doc(id).get();
    if (!doc.exists) return null;

    return {
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data()?.createdAt as Timestamp)?.toDate() || new Date(),
    } as ThemeBackup;
  } catch (error: any) {
    console.error('[DesignAgent] Failed to get backup:', error.message);
    return null;
  }
}

/**
 * Save analytics snapshot for comparison
 */
export async function saveAnalyticsSnapshot(analytics: any): Promise<void> {
  if (!initFirebase() || !db) return;

  try {
    await db.collection(ANALYTICS_COLLECTION).add({
      ...analytics,
      collectedAt: FieldValue.serverTimestamp(),
    });
  } catch (error: any) {
    console.error('[DesignAgent] Failed to save analytics:', error.message);
  }
}

/**
 * Get previous analytics snapshot for comparison
 */
export async function getPreviousAnalytics(): Promise<any | null> {
  if (!initFirebase() || !db) return null;

  try {
    const snapshot = await db
      .collection(ANALYTICS_COLLECTION)
      .orderBy('collectedAt', 'desc')
      .limit(2)
      .get();

    // Return the second most recent (previous)
    if (snapshot.docs.length >= 2) {
      return snapshot.docs[1].data();
    }
    return null;
  } catch (error: any) {
    console.error('[DesignAgent] Failed to get previous analytics:', error.message);
    return null;
  }
}

/**
 * Get recommendation statistics
 */
export async function getRecommendationStats(): Promise<{
  pending: number;
  approved: number;
  applied: number;
  rejected: number;
  avgImpact: number;
}> {
  if (!initFirebase() || !db) {
    return { pending: 0, approved: 0, applied: 0, rejected: 0, avgImpact: 0 };
  }

  try {
    const snapshot = await db.collection(RECOMMENDATIONS_COLLECTION).get();
    
    const stats = {
      pending: 0,
      approved: 0,
      applied: 0,
      rejected: 0,
      totalImpact: 0,
      count: 0,
    };

    snapshot.docs.forEach((doc) => {
      const data = doc.data();
      stats[data.status as keyof typeof stats]++;
      if (data.results?.improvement) {
        stats.totalImpact += data.results.improvement;
        stats.count++;
      }
    });

    return {
      pending: stats.pending,
      approved: stats.approved,
      applied: stats.applied,
      rejected: stats.rejected,
      avgImpact: stats.count > 0 ? stats.totalImpact / stats.count : 0,
    };
  } catch (error: any) {
    console.error('[DesignAgent] Failed to get stats:', error.message);
    return { pending: 0, approved: 0, applied: 0, rejected: 0, avgImpact: 0 };
  }
}

/**
 * Clean up old recommendations (older than 30 days)
 */
export async function cleanupOldRecommendations(daysOld: number = 30): Promise<number> {
  if (!initFirebase() || !db) return 0;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  try {
    const snapshot = await db
      .collection(RECOMMENDATIONS_COLLECTION)
      .where('createdAt', '<', cutoff)
      .where('status', 'in', ['rejected', 'applied'])
      .get();

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    console.log(`[DesignAgent] Cleaned up ${snapshot.docs.length} old recommendations`);
    return snapshot.docs.length;
  } catch (error: any) {
    console.error('[DesignAgent] Cleanup failed:', error.message);
    return 0;
  }
}


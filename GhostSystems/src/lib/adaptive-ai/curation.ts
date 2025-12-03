/**
 * Curation Controls for Adaptive AI
 * 
 * Ensures generated products feel curated, special, and unique
 * rather than spammy or automated.
 */

import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';

export interface CurationRules {
  minConfidence: number; // Only generate high-confidence products (0-1)
  checkDuplicates: boolean; // Prevent similar products
  maxSimilarityPercent: number; // Max similarity to existing products (0-100)
  requireManualReview: boolean; // Add products as "pending_review" instead of "pending"
  maxProductsPerDay: number; // Limit daily generation
  maxProductsPerNiche: number; // Limit products per niche
  minDaysBetweenSimilar: number; // Days before allowing similar products
}

/**
 * Generates a deduplication key for a product
 * Similar products will have similar keys
 */
export function generateDedupeKey(
  productType: string,
  niche: string,
  title: string
): string {
  const normalizedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Extract key words (remove common words like "pack", "prompt", numbers)
  const words = normalizedTitle
    .split(' ')
    .filter(word => {
      const common = ['pack', 'prompts', 'prompt', 'kit', 'automation', 'bundle', 'high', 'ticket'];
      return !common.includes(word) && !/^\d+$/.test(word);
    })
    .slice(0, 5); // Take first 5 meaningful words
  
  const base = `${productType}:${niche}:${words.join(':')}`;
  return crypto.createHash('sha256').update(base).digest('hex').substring(0, 16);
}

/**
 * Checks if a product is too similar to existing products
 */
export async function checkForDuplicates(
  productType: string,
  niche: string,
  title: string,
  collectionName: string = 'products',
  maxSimilarity: number = 80
): Promise<{ isDuplicate: boolean; similarProducts: Array<{ id: string; title: string; similarity: number }> }> {
  const db = getFirestore();
  const dedupeKey = generateDedupeKey(productType, niche, title);
  
  // Get existing products in same niche and type
  const existingProducts = await db
    .collection(collectionName)
    .where('niche', '==', niche)
    .where('productType', '==', productType)
    .get();
  
  const similarProducts: Array<{ id: string; title: string; similarity: number }> = [];
  
  for (const doc of existingProducts.docs) {
    const existingTitle = doc.data().title || '';
    const similarity = calculateSimilarity(title.toLowerCase(), existingTitle.toLowerCase());
    
    if (similarity >= maxSimilarity) {
      similarProducts.push({
        id: doc.id,
        title: existingTitle,
        similarity,
      });
    }
  }
  
  return {
    isDuplicate: similarProducts.length > 0,
    similarProducts,
  };
}

/**
 * Calculate similarity between two strings (0-100)
 */
function calculateSimilarity(str1: string, str2: string): number {
  // Simple word-based similarity
  const words1 = new Set(str1.split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(str2.split(/\s+/).filter(w => w.length > 3));
  
  if (words1.size === 0 && words2.size === 0) return 100;
  if (words1.size === 0 || words2.size === 0) return 0;
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  return Math.round((intersection.size / union.size) * 100);
}

/**
 * Checks if we've exceeded daily generation limits
 */
export async function checkDailyLimit(
  collectionName: string = 'products',
  maxPerDay: number = 5
): Promise<{ withinLimit: boolean; countToday: number }> {
  const db = getFirestore();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayProducts = await db
    .collection(collectionName)
    .where('source', '==', 'adaptive_ai')
    .where('createdAt', '>=', today)
    .get();
  
  const countToday = todayProducts.size;
  
  return {
    withinLimit: countToday < maxPerDay,
    countToday,
  };
}

/**
 * Checks if niche has too many products already
 */
export async function checkNicheLimit(
  niche: string,
  collectionName: string = 'products',
  maxPerNiche: number = 50
): Promise<{ withinLimit: boolean; count: number }> {
  const db = getFirestore();
  
  const nicheProducts = await db
    .collection(collectionName)
    .where('niche', '==', niche)
    .where('status', 'in', ['pending', 'draft', 'processing', 'published'])
    .get();
  
  const count = nicheProducts.size;
  
  return {
    withinLimit: count < maxPerNiche,
    count,
  };
}

/**
 * Applies all curation rules before generating a product
 */
export async function shouldGenerateProduct(
  productType: string,
  niche: string,
  title: string,
  confidence: number,
  rules: CurationRules,
  collectionName: string = 'products'
): Promise<{ allowed: boolean; reason?: string }> {
  // Check confidence threshold
  if (confidence < rules.minConfidence) {
    return {
      allowed: false,
      reason: `Confidence ${(confidence * 100).toFixed(0)}% below minimum ${(rules.minConfidence * 100).toFixed(0)}%`,
    };
  }
  
  // Check daily limit
  if (rules.maxProductsPerDay > 0) {
    const dailyCheck = await checkDailyLimit(collectionName, rules.maxProductsPerDay);
    if (!dailyCheck.withinLimit) {
      return {
        allowed: false,
        reason: `Daily limit reached (${dailyCheck.countToday}/${rules.maxProductsPerDay} products today)`,
      };
    }
  }
  
  // Check niche limit
  if (rules.maxProductsPerNiche > 0) {
    const nicheCheck = await checkNicheLimit(niche, collectionName, rules.maxProductsPerNiche);
    if (!nicheCheck.withinLimit) {
      return {
        allowed: false,
        reason: `Niche "${niche}" limit reached (${nicheCheck.count}/${rules.maxProductsPerNiche} products)`,
      };
    }
  }
  
  // Check for duplicates
  if (rules.checkDuplicates) {
    const duplicateCheck = await checkForDuplicates(
      productType,
      niche,
      title,
      collectionName,
      rules.maxSimilarityPercent
    );
    
    if (duplicateCheck.isDuplicate) {
      const similar = duplicateCheck.similarProducts[0];
      return {
        allowed: false,
        reason: `Too similar to existing product "${similar.title}" (${similar.similarity}% similarity)`,
      };
    }
  }
  
  return { allowed: true };
}

/**
 * Get default curation rules (conservative/curated)
 */
export function getDefaultCurationRules(): CurationRules {
  return {
    minConfidence: 0.7, // Only high-confidence products (70%+)
    checkDuplicates: true,
    maxSimilarityPercent: 70, // Block if 70%+ similar
    requireManualReview: false, // Set to true for manual approval
    maxProductsPerDay: 3, // Max 3 products per day
    maxProductsPerNiche: 50, // Max 50 products per niche
    minDaysBetweenSimilar: 7, // 7 days before allowing similar products
  };
}

/**
 * Get relaxed curation rules (more products, less strict)
 */
export function getRelaxedCurationRules(): CurationRules {
  return {
    minConfidence: 0.5, // Medium confidence (50%+)
    checkDuplicates: true,
    maxSimilarityPercent: 85, // Block only if 85%+ similar
    requireManualReview: false,
    maxProductsPerDay: 10, // Up to 10 products per day
    maxProductsPerNiche: 100, // Up to 100 per niche
    minDaysBetweenSimilar: 3, // 3 days between similar
  };
}

/**
 * Get strict curation rules (very selective, premium feel)
 */
export function getStrictCurationRules(): CurationRules {
  return {
    minConfidence: 0.85, // Very high confidence (85%+)
    checkDuplicates: true,
    maxSimilarityPercent: 60, // Block if 60%+ similar
    requireManualReview: true, // Require manual review
    maxProductsPerDay: 1, // Max 1 product per day
    maxProductsPerNiche: 25, // Max 25 per niche
    minDaysBetweenSimilar: 14, // 14 days between similar
  };
}


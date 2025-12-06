/**
 * Traffic Generation Strategies
 * 
 * Identifies opportunities to drive traffic:
 * - Trending keywords
 * - Product bundles
 * - Limited-time offers
 * - Cross-selling opportunities
 */

import { fetchProducts } from '../shopify.js';
import { generateDescription } from '../gemini.js';
import { getFirestore } from 'firebase-admin/firestore';

const db = getFirestore();
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL || '';
const BASE_STORE_URL = `https://${SHOPIFY_STORE_URL.replace(/^https?:\/\//, '')}`;

export interface TrafficStrategy {
  type: 'keyword_content' | 'product_bundle' | 'limited_offer' | 'cross_sell';
  title: string;
  description: string;
  products?: string[];
  keywords?: string[];
  discount?: number;
  urgency?: string;
}

/**
 * Identify trending keywords from product data
 */
export async function identifyTrendingKeywords(): Promise<string[]> {
  try {
    const products = await fetchProducts();
    
    // Extract keywords from product titles and descriptions
    const keywordMap = new Map<string, number>();
    
    products.forEach((product: any) => {
      const text = `${product.title} ${product.body_html || ''}`.toLowerCase();
      const words = text.match(/\b[a-z]{4,}\b/g) || [];
      
      words.forEach(word => {
        if (word.length >= 4) {
          keywordMap.set(word, (keywordMap.get(word) || 0) + 1);
        }
      });
    });

    // Sort by frequency and return top keywords
    const sorted = Array.from(keywordMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word);

    return sorted;
  } catch (error: any) {
    console.error('[Traffic] Failed to identify keywords:', error.message);
    return [];
  }
}

/**
 * Generate product bundle strategy
 */
export async function generateProductBundle(
  products: Array<{ id: string; title: string; price: number }>
): Promise<TrafficStrategy> {
  const totalPrice = products.reduce((sum, p) => sum + p.price, 0);
  const bundlePrice = Math.round(totalPrice * 0.75); // 25% discount
  const savings = totalPrice - bundlePrice;

  return {
    type: 'product_bundle',
    title: `${products.length}-Product Bundle - Save $${savings}`,
    description: `Get ${products.length} premium products for just $${bundlePrice} (save $${savings}!). Perfect bundle for creators and businesses.`,
    products: products.map(p => String(p.id)),
    discount: 25,
  };
}

/**
 * Generate limited-time offer
 */
export async function generateLimitedOffer(
  productId: string,
  discount: number = 20
): Promise<TrafficStrategy> {
  try {
    const products = await getProducts();
    const product = products.find((p: any) => String(p.id) === productId);
    
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    const originalPrice = product.variants?.[0]?.price || 0;
    const discountedPrice = originalPrice * (1 - discount / 100);

    return {
      type: 'limited_offer',
      title: `Limited Time: ${discount}% Off ${product.title}`,
      description: `Get ${product.title} for just $${discountedPrice.toFixed(2)} (was $${originalPrice}). Offer expires in 48 hours!`,
      products: [productId],
      discount,
      urgency: '48 hours',
    };
  } catch (error: any) {
    console.error('[Traffic] Failed to generate limited offer:', error.message);
    throw error;
  }
}

/**
 * Generate cross-selling opportunities
 */
export async function generateCrossSellStrategies(): Promise<TrafficStrategy[]> {
  try {
    const products = await fetchProducts();
    const strategies: TrafficStrategy[] = [];

    // Group products by category
    const categories = new Map<string, any[]>();
    products.forEach((product: any) => {
      const category = product.product_type || 'Digital Products';
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push(product);
    });

    // Create cross-sell bundles for each category
    for (const [category, categoryProducts] of categories) {
      if (categoryProducts.length >= 2) {
        const bundle = await generateProductBundle(
          categoryProducts.slice(0, 3).map((p: any) => ({
            id: String(p.id),
            title: p.title,
            price: parseFloat(p.variants?.[0]?.price || '0'),
          }))
        );
        bundle.title = `${category} Bundle - ${bundle.title}`;
        strategies.push(bundle);
      }
    }

    return strategies;
  } catch (error: any) {
    console.error('[Traffic] Failed to generate cross-sell strategies:', error.message);
    return [];
  }
}

/**
 * Generate content ideas based on trending keywords
 */
export async function generateKeywordContentIdeas(): Promise<TrafficStrategy[]> {
  try {
    const keywords = await identifyTrendingKeywords();
    const strategies: TrafficStrategy[] = [];

    // Generate content ideas for top keywords
    for (const keyword of keywords.slice(0, 5)) {
      strategies.push({
        type: 'keyword_content',
        title: `Create content about: ${keyword}`,
        description: `Generate blog posts, guides, or landing pages targeting "${keyword}" to drive organic traffic.`,
        keywords: [keyword],
      });
    }

    return strategies;
  } catch (error: any) {
    console.error('[Traffic] Failed to generate keyword content ideas:', error.message);
    return [];
  }
}

/**
 * Get all traffic generation strategies
 */
export async function getAllTrafficStrategies(): Promise<TrafficStrategy[]> {
  const strategies: TrafficStrategy[] = [];

  try {
    // Cross-sell bundles
    const crossSell = await generateCrossSellStrategies();
    strategies.push(...crossSell);

    // Keyword content ideas
    const keywordContent = await generateKeywordContentIdeas();
    strategies.push(...keywordContent);

    // Limited-time offers (for top products)
    const products = await fetchProducts();
    const topProducts = products.slice(0, 3);
    for (const product of topProducts) {
      try {
        const offer = await generateLimitedOffer(String(product.id), 20);
        strategies.push(offer);
      } catch (error) {
        // Skip if generation fails
      }
    }

    return strategies;
  } catch (error: any) {
    console.error('[Traffic] Failed to generate traffic strategies:', error.message);
    return strategies;
  }
}


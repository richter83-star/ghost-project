/**
 * Store Design Agent - AI Design Recommendation Generator
 * 
 * Uses Gemini AI to analyze store data and generate design recommendations.
 * Now includes brand analysis from store logo for aligned recommendations.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';
import {
  DesignRecommendation,
  StoreAnalytics,
  RecommendationType,
  RecommendationPriority,
} from './types.js';
import { getBrandProfile, generateBrandPrompt, BrandProfile } from './brand-analyzer.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Cache brand profile to avoid re-analyzing on every run
let cachedBrandProfile: BrandProfile | null = null;
let brandProfileCacheTime: number = 0;
const BRAND_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get cached brand profile or fetch new one
 */
async function getCachedBrandProfile(): Promise<BrandProfile | null> {
  const now = Date.now();
  
  // Return cached if still valid
  if (cachedBrandProfile && (now - brandProfileCacheTime) < BRAND_CACHE_DURATION) {
    return cachedBrandProfile;
  }
  
  // Fetch new brand profile
  console.log('[DesignAgent] 🎨 Analyzing brand from logo...');
  try {
    cachedBrandProfile = await getBrandProfile();
    brandProfileCacheTime = now;
    return cachedBrandProfile;
  } catch (error: any) {
    console.warn('[DesignAgent] Brand analysis failed:', error.message);
    return null;
  }
}

/**
 * Generate design recommendations based on store analytics and brand identity
 */
export async function generateRecommendations(
  analytics: StoreAnalytics,
  minConfidence: number = 0.7
): Promise<DesignRecommendation[]> {
  console.log('[DesignAgent] 🧠 Generating design recommendations...');
  
  // Get brand profile (from logo analysis)
  const brandProfile = await getCachedBrandProfile();
  if (brandProfile) {
    console.log(`[DesignAgent] 🎨 Using brand profile: ${brandProfile.style.aesthetic} / ${brandProfile.style.mood}`);
    console.log(`[DesignAgent] 🎨 Brand colors: ${brandProfile.colors.primary}, ${brandProfile.colors.secondary}`);
  }
  
  const recommendations: DesignRecommendation[] = [];

  // Rule-based recommendations (high confidence)
  recommendations.push(...generateSEORecommendations(analytics));
  recommendations.push(...generateProductRecommendations(analytics));
  recommendations.push(...generateCollectionRecommendations(analytics));
  
  // AI-powered recommendations (now with brand context)
  const aiRecommendations = await generateAIRecommendations(analytics, brandProfile);
  recommendations.push(...aiRecommendations);

  // Filter by confidence threshold
  const filtered = recommendations.filter(r => r.metrics.confidence >= minConfidence);
  
  // Sort by priority and confidence
  filtered.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.metrics.confidence - a.metrics.confidence;
  });

  console.log(`[DesignAgent] ✅ Generated ${filtered.length} recommendations (${recommendations.length - filtered.length} filtered by confidence)`);
  
  return filtered;
}

/**
 * Generate SEO-focused recommendations
 */
function generateSEORecommendations(analytics: StoreAnalytics): DesignRecommendation[] {
  const recs: DesignRecommendation[] = [];
  const { seo, products } = analytics;

  // Missing meta descriptions
  if (seo.productsMissingMeta > 0) {
    const percentage = Math.round((seo.productsMissingMeta / products.total) * 100);
    recs.push({
      id: uuidv4(),
      type: 'seo',
      priority: percentage > 50 ? 'high' : 'medium',
      impact: 'seo',
      title: `Add meta descriptions to ${seo.productsMissingMeta} products`,
      description: `${percentage}% of your products are missing SEO meta descriptions. This hurts search rankings and click-through rates from Google.`,
      currentState: `${seo.productsMissingMeta} products without meta descriptions`,
      proposedState: 'AI-generated meta descriptions for all products',
      implementation: {
        type: 'product',
        target: 'bulk',
        changes: { action: 'generate_meta_descriptions' },
      },
      metrics: {
        estimatedImpact: Math.min(percentage * 0.2, 15), // Up to 15% improvement
        confidence: 0.92,
        basedOn: ['product_analysis', 'seo_best_practices'],
      },
      status: 'pending',
      createdAt: new Date(),
    });
  }

  // Short product descriptions
  if (seo.avgDescriptionLength < 150) {
    recs.push({
      id: uuidv4(),
      type: 'copy',
      priority: 'medium',
      impact: 'conversion',
      title: 'Enhance product descriptions',
      description: `Average description length is only ${seo.avgDescriptionLength} characters. Detailed descriptions improve SEO and conversions.`,
      currentState: `Average ${seo.avgDescriptionLength} characters`,
      proposedState: 'AI-enhanced descriptions (300+ characters each)',
      implementation: {
        type: 'product',
        target: 'bulk',
        changes: { action: 'enhance_descriptions', minLength: 300 },
      },
      metrics: {
        estimatedImpact: 12,
        confidence: 0.85,
        basedOn: ['content_analysis', 'conversion_best_practices'],
      },
      status: 'pending',
      createdAt: new Date(),
    });
  }

  return recs;
}

/**
 * Generate product-focused recommendations
 */
function generateProductRecommendations(analytics: StoreAnalytics): DesignRecommendation[] {
  const recs: DesignRecommendation[] = [];
  const { products } = analytics;

  // Products without images
  const missingImages = products.total - products.withImages;
  if (missingImages > 0) {
    recs.push({
      id: uuidv4(),
      type: 'image',
      priority: 'high',
      impact: 'conversion',
      title: `Add images to ${missingImages} products`,
      description: 'Products without images have significantly lower conversion rates. AI can generate professional images.',
      currentState: `${missingImages} products without images`,
      proposedState: 'AI-generated product images',
      implementation: {
        type: 'product',
        target: 'bulk',
        changes: { action: 'generate_images' },
      },
      metrics: {
        estimatedImpact: 25,
        confidence: 0.88,
        basedOn: ['product_analysis', 'ecommerce_benchmarks'],
      },
      status: 'pending',
      createdAt: new Date(),
    });
  }

  // Underperforming products
  if (products.underperformers.length > 5) {
    recs.push({
      id: uuidv4(),
      type: 'product_page',
      priority: 'medium',
      impact: 'conversion',
      title: `Optimize ${products.underperformers.length} underperforming products`,
      description: 'These products have no sales. Consider updating titles, descriptions, images, or pricing.',
      currentState: `${products.underperformers.length} products with zero sales`,
      proposedState: 'Refreshed product content and optimized pricing',
      implementation: {
        type: 'product',
        target: 'underperformers',
        changes: { 
          action: 'optimize_underperformers',
          products: products.underperformers.map(p => p.id),
        },
      },
      metrics: {
        estimatedImpact: 15,
        confidence: 0.75,
        basedOn: ['sales_analysis', 'product_performance'],
      },
      status: 'pending',
      createdAt: new Date(),
    });
  }

  // Homepage showcase based on top performers
  if (products.topPerformers.length >= 3) {
    recs.push({
      id: uuidv4(),
      type: 'homepage',
      priority: 'medium',
      impact: 'conversion',
      title: 'Feature top performers on homepage',
      description: `Your top ${products.topPerformers.length} products are proven sellers. Showcase them prominently on your homepage.`,
      currentState: 'Generic homepage product display',
      proposedState: `Featured collection with: ${products.topPerformers.slice(0, 3).map(p => p.title).join(', ')}`,
      implementation: {
        type: 'theme_asset',
        target: 'sections/featured-collection.liquid',
        changes: { 
          action: 'update_featured',
          products: products.topPerformers.slice(0, 6).map(p => p.id),
        },
      },
      metrics: {
        estimatedImpact: 10,
        confidence: 0.82,
        basedOn: ['sales_data', 'homepage_best_practices'],
      },
      status: 'pending',
      createdAt: new Date(),
    });
  }

  return recs;
}

/**
 * Generate collection-focused recommendations
 */
function generateCollectionRecommendations(analytics: StoreAnalytics): DesignRecommendation[] {
  const recs: DesignRecommendation[] = [];
  const { collections } = analytics;

  // Collections without images
  const missingImages = collections.total - collections.withImages;
  if (missingImages > 0 && collections.total > 0) {
    recs.push({
      id: uuidv4(),
      type: 'collection',
      priority: 'medium',
      impact: 'brand',
      title: `Add images to ${missingImages} collections`,
      description: 'Collection images improve navigation and brand perception.',
      currentState: `${missingImages} collections without banner images`,
      proposedState: 'AI-generated collection banners',
      implementation: {
        type: 'collection',
        target: 'bulk',
        changes: { action: 'generate_collection_images' },
      },
      metrics: {
        estimatedImpact: 8,
        confidence: 0.78,
        basedOn: ['collection_analysis', 'ux_best_practices'],
      },
      status: 'pending',
      createdAt: new Date(),
    });
  }

  // Collections without descriptions
  const missingDescriptions = collections.total - collections.withDescriptions;
  if (missingDescriptions > 0 && collections.total > 0) {
    recs.push({
      id: uuidv4(),
      type: 'collection',
      priority: 'low',
      impact: 'seo',
      title: `Add descriptions to ${missingDescriptions} collections`,
      description: 'Collection descriptions improve SEO and help customers understand product groupings.',
      currentState: `${missingDescriptions} collections without descriptions`,
      proposedState: 'AI-generated collection descriptions',
      implementation: {
        type: 'collection',
        target: 'bulk',
        changes: { action: 'generate_collection_descriptions' },
      },
      metrics: {
        estimatedImpact: 5,
        confidence: 0.80,
        basedOn: ['collection_analysis', 'seo_best_practices'],
      },
      status: 'pending',
      createdAt: new Date(),
    });
  }

  return recs;
}

/**
 * Generate AI-powered recommendations using Gemini
 * Now includes brand profile for aligned recommendations
 */
async function generateAIRecommendations(
  analytics: StoreAnalytics,
  brandProfile: BrandProfile | null
): Promise<DesignRecommendation[]> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[DesignAgent] GEMINI_API_KEY not set, skipping AI recommendations');
    return [];
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Build brand context section
    const brandContext = brandProfile ? `
${generateBrandPrompt(brandProfile)}
` : '';

    const prompt = `You are an expert e-commerce store designer and conversion optimizer.
${brandContext}
Analyze this store data and suggest 2-3 specific design improvements that ALIGN WITH THE BRAND PROFILE above:

STORE DATA:
- Products: ${analytics.products.total} total, ${analytics.products.withImages} with images
- Average description length: ${analytics.seo.avgDescriptionLength} characters
- Collections: ${analytics.collections.total}
- Orders: ${analytics.conversionFunnel.purchase}
- Customers: ${analytics.customers.total}
- Average order value: $${analytics.customers.avgOrderValue}
- Theme: ${analytics.theme.name}
- SEO Issues: ${analytics.seo.issues.join(', ') || 'None identified'}
- Top selling products: ${analytics.products.topPerformers.slice(0, 3).map(p => p.title).join(', ') || 'No sales data'}

For each recommendation:
1. Type: one of [homepage, product_page, collection, navigation, seo, brand, copy, image]
2. Priority: high/medium/low
3. Title: short actionable title
4. Description: why this matters AND how it aligns with the brand
5. Estimated impact: percentage improvement (be realistic)
6. Confidence: 0-1 scale
${brandProfile ? `7. Include specific color codes (${brandProfile.colors.primary}, ${brandProfile.colors.secondary}, ${brandProfile.colors.accent}) and font suggestions (${brandProfile.typography.recommended.join(', ')}) where relevant` : ''}

Respond in JSON format:
[
  {
    "type": "string",
    "priority": "string",
    "title": "string",
    "description": "string",
    "estimatedImpact": number,
    "confidence": number
  }
]

Focus on actionable, high-impact changes that match the brand identity. Be specific with colors, fonts, and styling.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Extract JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('[DesignAgent] Could not parse AI response');
      return [];
    }

    const aiSuggestions = JSON.parse(jsonMatch[0]);
    
    return aiSuggestions.map((suggestion: any) => ({
      id: uuidv4(),
      type: suggestion.type as RecommendationType,
      priority: suggestion.priority as RecommendationPriority,
      impact: 'all',
      title: suggestion.title,
      description: suggestion.description,
      currentState: 'Current store design',
      proposedState: suggestion.title,
      implementation: {
        type: 'theme_asset',
        target: 'ai_generated',
        changes: { suggestion },
      },
      metrics: {
        estimatedImpact: suggestion.estimatedImpact,
        confidence: suggestion.confidence,
        basedOn: ['ai_analysis', 'store_data'],
      },
      status: 'pending',
      createdAt: new Date(),
    }));
  } catch (error: any) {
    console.error('[DesignAgent] AI recommendation generation failed:', error.message);
    return [];
  }
}

/**
 * Generate copy/text content using AI
 */
export async function generateCopy(
  type: 'meta_description' | 'product_description' | 'collection_description',
  context: {
    title: string;
    productType?: string;
    existingContent?: string;
    keywords?: string[];
  }
): Promise<string | null> {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompts: Record<string, string> = {
      meta_description: `Write an SEO-optimized meta description (150-160 characters) for this product:
Title: ${context.title}
Type: ${context.productType || 'Digital Product'}
Keywords: ${context.keywords?.join(', ') || 'digital, download, instant'}

The meta description should be compelling, include the main keyword naturally, and encourage clicks.
Return ONLY the meta description text, nothing else.`,

      product_description: `Write a compelling product description (200-300 words) for this digital product:
Title: ${context.title}
Type: ${context.productType || 'Digital Product'}
Current description: ${context.existingContent || 'None'}

The description should:
- Highlight key benefits and features
- Use persuasive language
- Include relevant keywords naturally
- Format with short paragraphs for readability

Return the description in HTML format with <p> tags.`,

      collection_description: `Write a brief collection description (50-100 words) for:
Collection: ${context.title}

The description should explain what products are in this collection and why customers should browse it.
Return ONLY the description text.`,
    };

    const result = await model.generateContent(prompts[type]);
    return result.response.text().trim();
  } catch (error: any) {
    console.error('[DesignAgent] Copy generation failed:', error.message);
    return null;
  }
}


/**
 * Adaptive AI Product Generator
 * 
 * Generates products based on learned insights from sales data,
 * market trends, and customer behavior. Continuously adapts to
 * improve product-market fit.
 */

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { generateMarketInsights, MarketInsights, NichePerformance } from './analytics.js';
import { generateDescription } from '../gemini.js';
import {
  shouldGenerateProduct,
  getDefaultCurationRules,
  getStrictCurationRules,
  getRelaxedCurationRules,
  CurationRules,
} from './curation.js';

interface ProductGenerationStrategy {
  productType: 'prompt_pack' | 'automation_kit' | 'bundle';
  niche: string;
  priceRange: { min: number; max: number };
  tags: string[];
  reasoning: string;
  confidence: number; // 0-1, how confident we are this will perform well
}

interface GeneratedProduct {
  title: string;
  description: string;
  productType: 'prompt_pack' | 'automation_kit' | 'bundle';
  niche: string;
  price_usd: number;
  tags: string[];
  source: 'adaptive_ai';
  version: string;
  strategy: ProductGenerationStrategy;
  metrics: {
    expectedSalesVelocity: number;
    expectedRevenue: number;
    riskScore: number; // 0-1, lower is better
  };
}

// Product templates (enhanced from Oracle, but will be refined by AI)
const PROMPT_PACK_TEMPLATES = [
  { theme: 'Cyber-Noir Product Covers', models: ['Midjourney', 'DALL·E', 'SDXL'] },
  { theme: 'Luxury Minimalist Bundle Covers', models: ['Midjourney', 'DALL·E', 'SDXL'] },
  { theme: 'Blueprint / Technical Diagram Aesthetic', models: ['Midjourney', 'DALL·E'] },
  { theme: 'Neon Dark UI Illustrations', models: ['Midjourney', 'SDXL'] },
  { theme: 'Editorial Tech Photography Prompts', models: ['Midjourney', 'DALL·E'] },
];

const AUTOMATION_KIT_TEMPLATES = [
  { name: 'Notion CRM + Intake Automation', integrations: ['Notion', 'Gmail', 'Calendly'] },
  { name: 'Lead Capture to Follow-up Engine', integrations: ['Google Sheets', 'Gmail', 'Slack'] },
  { name: 'E-commerce Abandoned Cart Revival', integrations: ['Shopify', 'Klaviyo', 'Gmail'] },
  { name: 'Client Onboarding Workflow', integrations: ['Typeform', 'DocuSign', 'Notion'] },
  { name: 'Content Repurposing Pipeline', integrations: ['YouTube', 'Drive', 'Notion'] },
];

const PLATFORMS = ['n8n', 'Make', 'Zapier'];

const NICHES = [
  { key: 'solopreneurs', desc: 'one-person operators shipping fast' },
  { key: 'creators', desc: 'YouTube/TikTok/newsletter creators' },
  { key: 'agencies', desc: 'service businesses packaging ROI' },
  { key: 'ecommerce', desc: 'Shopify operators improving conversion' },
  { key: 'b2b_saas', desc: 'SaaS founders improving funnel + retention' },
];

/**
 * Generates product generation strategies based on market insights
 */
export async function generateStrategies(
  insights: MarketInsights,
  count: number = 3
): Promise<ProductGenerationStrategy[]> {
  const strategies: ProductGenerationStrategy[] = [];

  // Strategy 1: Generate more of top-performing combinations
  for (const rec of insights.recommendations.generateMore.slice(0, count)) {
    const niche = insights.topPerformingNiches.find(n => n.niche === rec.niche);
    const optimalPrice = insights.optimalPriceRanges[rec.type];
    
    if (niche && optimalPrice) {
      strategies.push({
        productType: rec.type as 'prompt_pack' | 'automation_kit' | 'bundle',
        niche: rec.niche,
        priceRange: {
          min: optimalPrice.min,
          max: optimalPrice.max,
        },
        tags: [...niche.trendingTags, rec.type],
        reasoning: rec.reason,
        confidence: 0.8, // High confidence for proven combinations
      });
    }
  }

  // Strategy 2: Explore trending types in underperforming niches (opportunity)
  const underperformingNiches = insights.topPerformingNiches
    .filter(n => n.growthRate < 0 && n.totalProducts < 5)
    .slice(0, 2);
  
  for (const niche of underperformingNiches) {
    for (const type of insights.trendingProductTypes.slice(0, 2)) {
      const optimalPrice = insights.optimalPriceRanges[type.type];
      if (optimalPrice) {
        strategies.push({
          productType: type.type as 'prompt_pack' | 'automation_kit' | 'bundle',
          niche: niche.niche,
          priceRange: {
            min: optimalPrice.min,
            max: optimalPrice.max,
          },
          tags: [...niche.trendingTags, type.type],
          reasoning: `Trending type (${type.growthRate.toFixed(1)}% growth) in underserved niche`,
          confidence: 0.6, // Medium confidence - opportunity but unproven
        });
      }
    }
  }

  // Strategy 3: High-value bundles (combine top performers)
  if (insights.topPerformingProducts.length >= 2) {
    const topPromptPack = insights.topPerformingProducts.find(p => p.productType === 'prompt_pack');
    const topAutomationKit = insights.topPerformingProducts.find(p => p.productType === 'automation_kit');
    
    if (topPromptPack && topAutomationKit && topPromptPack.niche === topAutomationKit.niche) {
      const bundlePrice = Math.round((topPromptPack.currentPrice + topAutomationKit.currentPrice) * 0.8);
      strategies.push({
        productType: 'bundle',
        niche: topPromptPack.niche!,
        priceRange: {
          min: bundlePrice * 0.9,
          max: bundlePrice * 1.1,
        },
        tags: ['bundle', 'high_ticket', topPromptPack.niche!],
        reasoning: `Bundle of top performers: ${topPromptPack.title} + ${topAutomationKit.title}`,
        confidence: 0.85, // Very high confidence for proven combinations
      });
    }
  }

  // Fallback: If no strategies from insights, generate based on existing niches/types
  if (strategies.length === 0) {
    console.log('[AdaptiveAI] No strategies from insights, generating fallback strategies from existing catalog...');
    
    // Use top niches and trending types
    for (const niche of insights.topPerformingNiches.slice(0, Math.min(3, count))) {
      // Find product types that exist in this niche
      const types = insights.trendingProductTypes
        .filter(t => ['prompt_pack', 'automation_kit', 'bundle'].includes(t.type))
        .slice(0, 1);
      
      for (const type of types.length > 0 ? types : [{ type: 'prompt_pack' as const, growthRate: 0, avgRevenue: 0 }]) {
        const optimalPrice = insights.optimalPriceRanges[type.type] || {
          min: type.type === 'prompt_pack' ? 19 : type.type === 'automation_kit' ? 29 : 79,
          max: type.type === 'prompt_pack' ? 49 : type.type === 'automation_kit' ? 79 : 199,
          avgRevenue: 0,
        };
        
        strategies.push({
          productType: type.type as 'prompt_pack' | 'automation_kit' | 'bundle',
          niche: niche.niche,
          priceRange: {
            min: optimalPrice.min,
            max: optimalPrice.max,
          },
          tags: [type.type, niche.niche, 'digital'],
          reasoning: `Fallback: Generating ${type.type} for ${niche.niche} niche based on existing catalog`,
          confidence: 0.5, // Lower confidence for fallback strategies
        });
        
        if (strategies.length >= count) break;
      }
      
      if (strategies.length >= count) break;
    }
  }

  // Sort by confidence and return top strategies
  return strategies
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, count);
}

/**
 * Generates a product based on a strategy
 */
export async function generateProduct(
  strategy: ProductGenerationStrategy
): Promise<GeneratedProduct> {
  const niche = NICHES.find(n => n.key === strategy.niche);
  if (!niche) {
    throw new Error(`Unknown niche: ${strategy.niche}`);
  }

  let title: string;
  let description: string;
  let payload: any;

  if (strategy.productType === 'prompt_pack') {
    const template = PROMPT_PACK_TEMPLATES[
      Math.floor(Math.random() * PROMPT_PACK_TEMPLATES.length)
    ];
    const packCount = [50, 75, 100][Math.floor(Math.random() * 3)];
    title = `${template.theme} Prompt Pack (${packCount} prompts)`;
    description = `A premium prompt pack for ${niche.desc}. Includes variations, negative prompts, and composition controls to generate consistent, sellable images.`;
    payload = {
      models: template.models,
      prompt_count: packCount,
      includes: ['style guide', 'negative prompts', 'composition recipes', 'bonus variants'],
      deliverables: ['prompt-pack.txt', 'prompt-pack.pdf', 'readme.md'],
    };
  } else if (strategy.productType === 'automation_kit') {
    const template = AUTOMATION_KIT_TEMPLATES[
      Math.floor(Math.random() * AUTOMATION_KIT_TEMPLATES.length)
    ];
    const platform = PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)];
    title = `${template.name} (${platform} Automation Kit)`;
    description = `A plug-and-play automation kit for ${niche.desc}. Built for ${platform}. Includes setup docs, workflow export, and a validation checklist.`;
    payload = {
      platform,
      integrations: template.integrations,
      includes: ['workflow.json', 'setup.md', 'qa-checklist.md', 'troubleshooting.md'],
      time_to_deploy_minutes: [20, 30, 45, 60][Math.floor(Math.random() * 4)],
    };
  } else {
    // Bundle - combine prompt pack + automation kit
    const promptTemplate = PROMPT_PACK_TEMPLATES[
      Math.floor(Math.random() * PROMPT_PACK_TEMPLATES.length)
    ];
    const kitTemplate = AUTOMATION_KIT_TEMPLATES[
      Math.floor(Math.random() * AUTOMATION_KIT_TEMPLATES.length)
    ];
    const platform = PLATFORMS[Math.floor(Math.random() * PLATFORMS.length)];
    
    title = `High-Ticket Bundle: Visuals + Automation (${strategy.niche})`;
    description = `A premium bundle for ${niche.desc}: a sellable image prompt pack plus a deployable automation kit. Designed to be bought together so the buyer gets results faster.`;
    payload = {
      bundle_includes: {
        prompt_pack: {
          theme: promptTemplate.theme,
          models: promptTemplate.models,
          prompt_count: [50, 75, 100][Math.floor(Math.random() * 3)],
        },
        automation_kit: {
          name: kitTemplate.name,
          platform,
          integrations: kitTemplate.integrations,
        },
      },
      positioning: 'Premium pairing: prompts + workflows',
    };
  }

  // Generate AI-enhanced description if Gemini is available
  try {
    const aiDescription = await generateDescription(title, strategy.productType);
    if (aiDescription) {
      description = aiDescription;
    }
  } catch (error) {
    console.warn('[AdaptiveAI] Failed to generate AI description, using template:', error);
  }

  // Calculate price (within strategy range)
  const priceRange = strategy.priceRange;
  const price = Math.round(
    priceRange.min + (priceRange.max - priceRange.min) * 0.5
  );

  // Estimate performance metrics
  const expectedSalesVelocity = strategy.confidence * 0.5; // sales per day
  const expectedRevenue = expectedSalesVelocity * price * 30; // monthly estimate
  const riskScore = 1 - strategy.confidence;

  return {
    title,
    description,
    productType: strategy.productType,
    niche: strategy.niche,
    price_usd: price,
    tags: [...strategy.tags, 'digital', 'adaptive_ai'],
    source: 'adaptive_ai',
    version: 'v1.0',
    strategy,
    metrics: {
      expectedSalesVelocity,
      expectedRevenue,
      riskScore,
    },
  };
}

/**
 * Get curation rules based on environment configuration
 */
function getCurationRules(): CurationRules {
  const curationLevel = process.env.ADAPTIVE_AI_CURATION_LEVEL || 'default';
  
  switch (curationLevel.toLowerCase()) {
    case 'strict':
      return getStrictCurationRules();
    case 'relaxed':
      return getRelaxedCurationRules();
    default:
      return getDefaultCurationRules();
  }
}

/**
 * Generates and saves products to Firestore with curation controls
 */
export async function generateAndSaveProducts(
  count: number = 3,
  collectionName: string = 'products'
): Promise<string[]> {
  console.log(`[AdaptiveAI] 🧠 Generating ${count} products based on market insights...`);

  // Get curation rules
  const curationRules = getCurationRules();
  console.log(`[AdaptiveAI] 🎨 Curation mode: ${process.env.ADAPTIVE_AI_CURATION_LEVEL || 'default'}`);
  console.log(`[AdaptiveAI] 🎨 Min confidence: ${(curationRules.minConfidence * 100).toFixed(0)}%, Max per day: ${curationRules.maxProductsPerDay}`);

  // Get market insights
  const insights = await generateMarketInsights(collectionName);
  console.log(`[AdaptiveAI] ✅ Analyzed ${insights.topPerformingProducts.length} products`);

  // Generate strategies (generate more than needed since some will be filtered)
  const strategies = await generateStrategies(insights, count * 2); // Generate 2x to account for filtering
  console.log(`[AdaptiveAI] 📊 Generated ${strategies.length} strategies`);

  if (strategies.length === 0) {
    console.warn('[AdaptiveAI] ⚠️ No strategies generated, falling back to default generation');
    // Fallback to Oracle-like generation if no strategies
    return [];
  }

  // Generate products with curation checks
  const db = getFirestore();
  const createdIds: string[] = [];

  for (const strategy of strategies) {
    // Stop if we've reached the desired count
    if (createdIds.length >= count) {
      break;
    }

    try {
      // Check confidence threshold first (fast check)
      if (strategy.confidence < curationRules.minConfidence) {
        console.log(
          `[AdaptiveAI] ⏭️ Skipping: Confidence ${(strategy.confidence * 100).toFixed(0)}% ` +
          `below minimum ${(curationRules.minConfidence * 100).toFixed(0)}%`
        );
        continue;
      }

      // Generate the product first (we need the title for duplicate checking)
      const product = await generateProduct(strategy);
      
      // Apply all curation rules now that we have the full product
      const curationCheck = await shouldGenerateProduct(
        product.productType,
        product.niche,
        product.title,
        strategy.confidence,
        curationRules,
        collectionName
      );

      if (!curationCheck.allowed) {
        console.log(`[AdaptiveAI] ⏭️ Skipping: ${curationCheck.reason}`);
        continue;
      }

      // Determine status based on curation rules
      const status = curationRules.requireManualReview ? 'pending_review' : 'pending';
      
      // Create Firestore document
      const docRef = db.collection(collectionName).doc();
      await docRef.set({
        ...product,
        status,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        is_digital: true,
        digital: true,
        requires_shipping: false,
        requiresShipping: false,
        currency: 'USD',
        dedupe_key: product.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').substring(0, 50), // For future duplicate checking
      });

      createdIds.push(docRef.id);
      const statusLabel = status === 'pending_review' ? ' (needs review)' : '';
      console.log(
        `[AdaptiveAI] ✅ Created product: "${product.title}"` + statusLabel +
        ` (${product.productType}, ${product.niche}, $${product.price_usd}, ` +
        `confidence: ${(strategy.confidence * 100).toFixed(0)}%)`
      );
    } catch (error: any) {
      console.error(`[AdaptiveAI] ❌ Failed to generate product:`, error.message);
    }
  }

  console.log(`[AdaptiveAI] 🎉 Generated ${createdIds.length} products (curated from ${strategies.length} strategies)`);
  return createdIds;
}


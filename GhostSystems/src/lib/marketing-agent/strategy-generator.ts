/**
 * Marketing Agent - AI Strategy Generator
 * 
 * Uses Gemini AI to analyze marketing performance and generate strategy recommendations
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { randomUUID } from 'crypto';
import { MarketingAnalytics, MarketingRecommendation, MarketingStrategyType } from './types.js';
import { getAvailablePlatforms } from './credentials.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Use Node's built-in crypto.randomUUID
const uuidv4 = () => randomUUID();

/**
 * Generate marketing strategy recommendations based on analytics
 */
export async function generateMarketingStrategies(
  analytics: MarketingAnalytics,
  previousAnalytics: MarketingAnalytics | null,
  minConfidence: number = 0.75
): Promise<MarketingRecommendation[]> {
  console.log('[MarketingAgent] 🧠 Generating marketing strategy recommendations...');

  if (!process.env.GEMINI_API_KEY) {
    console.warn('[MarketingAgent] GEMINI_API_KEY not set, skipping AI recommendations');
    return [];
  }

  // Check available platforms to filter recommendations
  const availablePlatforms = await getAvailablePlatforms();
  console.log(`[MarketingAgent] Available platforms: social=${availablePlatforms.social.join(',')}, blog=${availablePlatforms.blog.join(',')}`);

  const recommendations: MarketingRecommendation[] = [];

  // Rule-based recommendations (high confidence)
  recommendations.push(...generateRuleBasedRecommendations(analytics, previousAnalytics, availablePlatforms));

  // AI-powered recommendations
  const aiRecommendations = await generateAIRecommendations(analytics, previousAnalytics, availablePlatforms);
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

  console.log(`[MarketingAgent] ✅ Generated ${filtered.length} recommendations (${recommendations.length - filtered.length} filtered by confidence)`);

  return filtered;
}

/**
 * Generate rule-based recommendations (high confidence, data-driven)
 */
function generateRuleBasedRecommendations(
  analytics: MarketingAnalytics,
  previous: MarketingAnalytics | null,
  availablePlatforms: { social: string[]; blog: string[] }
): MarketingRecommendation[] {
  const recs: MarketingRecommendation[] = [];

  // Email campaign recommendations
  if (analytics.email.totalSent > 0 && analytics.email.openRate < 20) {
    recs.push({
      id: uuidv4(),
      type: 'email_campaign',
      priority: 'high',
      title: 'Optimize email subject lines to improve open rates',
      description: `Current open rate is ${analytics.email.openRate.toFixed(1)}%, which is below industry average (20%+). Optimizing subject lines can significantly improve engagement.`,
      currentState: `${analytics.email.openRate.toFixed(1)}% open rate`,
      proposedState: 'AI-optimized subject lines targeting 25%+ open rate',
      implementation: {
        campaignType: 'email_campaign',
        steps: [
          'Analyze current subject line performance',
          'Generate A/B test variants using AI',
          'Test top-performing subject lines',
          'Apply winning patterns to future campaigns',
        ],
        estimatedEffort: 'low',
        resources: {
          targetOpenRate: 25,
          currentOpenRate: analytics.email.openRate,
        },
      },
      metrics: {
        expectedImpact: 15, // 15% improvement in opens
        expectedTraffic: Math.round(analytics.email.totalSent * 0.05), // 5% more opens
        confidence: 0.88,
        basedOn: ['email_performance', 'industry_benchmarks'],
      },
      status: 'pending',
      createdAt: new Date(),
    });
  }

  // SEO recommendations
  if (analytics.seo.organicTraffic === 0 || analytics.seo.avgPosition > 50) {
    recs.push({
      id: uuidv4(),
      type: 'seo_optimization',
      priority: 'high',
      title: 'Improve SEO to increase organic traffic',
      description: 'Organic traffic is low or rankings are poor. SEO optimization can drive significant free traffic.',
      currentState: `${analytics.seo.organicTraffic} organic visitors, avg position ${analytics.seo.avgPosition}`,
      proposedState: 'Optimized meta tags, content, and structure for better rankings',
      implementation: {
        campaignType: 'seo_optimization',
        steps: [
          'Generate SEO-optimized meta descriptions for all products',
          'Add schema markup for better rich snippets',
          'Optimize product descriptions with target keywords',
          'Generate and submit sitemap',
        ],
        estimatedEffort: 'medium',
      },
      metrics: {
        expectedImpact: 30, // 30% increase in organic traffic
        expectedTraffic: 100, // Estimated new organic visitors
        confidence: 0.85,
        basedOn: ['seo_analysis', 'best_practices'],
      },
      status: 'pending',
      createdAt: new Date(),
    });
  }

  // Content marketing recommendations (only if blog platform available)
  if (availablePlatforms.blog.length > 0 && (analytics.content.totalPosts === 0 || analytics.content.avgViewsPerPost < 50)) {
    recs.push({
      id: uuidv4(),
      type: 'content_marketing',
      priority: 'medium',
      title: 'Create blog content to drive organic traffic',
      description: `Blog content can drive organic traffic and establish authority. Current content performance is low. Will publish to: ${availablePlatforms.blog.join(', ')}`,
      currentState: `${analytics.content.totalPosts} posts, ${analytics.content.avgViewsPerPost} avg views`,
      proposedState: `Weekly blog posts targeting high-value keywords (${availablePlatforms.blog.join(', ')})`,
      implementation: {
        campaignType: 'content_marketing',
        steps: [
          'Identify high-value keywords for product categories',
          'Generate SEO-optimized blog posts',
          `Publish weekly content to ${availablePlatforms.blog.join(' and ')}`,
          availablePlatforms.social.length > 0 ? 'Promote content on social media' : 'Share content via email',
        ],
        estimatedEffort: 'medium',
        resources: {
          platforms: availablePlatforms.blog,
        },
      },
      metrics: {
        expectedImpact: 25, // 25% increase in organic traffic
        expectedTraffic: 200, // Estimated monthly visitors from content
        confidence: 0.80,
        basedOn: ['content_analysis', 'seo_opportunities'],
      },
      status: 'pending',
      createdAt: new Date(),
    });
  } else if (availablePlatforms.blog.length === 0 && (analytics.content.totalPosts === 0 || analytics.content.avgViewsPerPost < 50)) {
    // Suggest setting up blog platform
    recs.push({
      id: uuidv4(),
      type: 'content_marketing',
      priority: 'low',
      title: 'Set up blog platform for content marketing',
      description: 'Blog content can drive organic traffic, but no blog platform is configured. Set up Shopify blog or WordPress to enable content campaigns.',
      currentState: 'No blog platform configured',
      proposedState: 'Configure Shopify blog or WordPress (see MARKETING_AGENT_SETUP.md)',
      implementation: {
        campaignType: 'content_marketing',
        steps: [
          'Set up Shopify blog API or WordPress REST API',
          'Configure credentials (see MARKETING_AGENT_SETUP.md)',
          'Re-run marketing agent to generate content campaigns',
        ],
        estimatedEffort: 'low',
      },
      metrics: {
        expectedImpact: 0,
        confidence: 0.5,
        basedOn: ['platform_analysis'],
      },
      status: 'pending',
      createdAt: new Date(),
    });
  }

  // Promotion recommendations
  if (analytics.conversion.conversionRate < 2) {
    recs.push({
      id: uuidv4(),
      type: 'promotion',
      priority: 'high',
      title: 'Create limited-time promotion to boost conversions',
      description: `Conversion rate is ${analytics.conversion.conversionRate.toFixed(1)}%. A strategic promotion can increase urgency and conversions.`,
      currentState: `${analytics.conversion.conversionRate.toFixed(1)}% conversion rate`,
      proposedState: 'Limited-time discount campaign with urgency messaging',
      implementation: {
        campaignType: 'promotion',
        steps: [
          'Identify best-performing products for promotion',
          'Create discount code (10-20% off)',
          'Generate promotional email campaign',
          'Update product pages with promotion banners',
        ],
        estimatedEffort: 'low',
        resources: {
          discountPercent: 15,
          duration: 7, // days
        },
      },
      metrics: {
        expectedImpact: 20, // 20% increase in conversions
        expectedConversions: Math.round(analytics.conversion.visitors * 0.024), // 2.4% conversion rate
        expectedRevenue: analytics.conversion.avgOrderValue * Math.round(analytics.conversion.visitors * 0.024) * 0.85, // 85% of normal price
        confidence: 0.82,
        basedOn: ['conversion_analysis', 'promotion_best_practices'],
      },
      status: 'pending',
      createdAt: new Date(),
    });
  }

  // Bundle creation recommendations (always available if we have conversion data)
  if (analytics.conversion.purchase > 0) {
    recs.push({
      id: uuidv4(),
      type: 'bundle_creation',
      priority: 'medium',
      title: 'Create product bundles to increase average order value',
      description: 'Bundling complementary products can increase revenue per customer.',
      currentState: `Average order value: $${analytics.conversion.avgOrderValue.toFixed(2)}`,
      proposedState: 'Strategic product bundles with 15-20% discount',
      implementation: {
        campaignType: 'bundle_creation',
        steps: [
          'Identify complementary top-performing products',
          'Create bundle collections in Shopify',
          'Set bundle pricing (15-20% discount)',
          'Promote bundles on product pages',
        ],
        estimatedEffort: 'medium',
      },
      metrics: {
        expectedImpact: 15, // 15% increase in AOV
        expectedRevenue: analytics.conversion.avgOrderValue * 1.15 * analytics.conversion.purchase * 0.1, // 10% of customers buy bundles
        confidence: 0.78,
        basedOn: ['conversion_analysis', 'bundle_strategies'],
      },
      status: 'pending',
      createdAt: new Date(),
    });
  }

  return recs;
}

/**
 * Generate AI-powered marketing recommendations using Gemini
 */
async function generateAIRecommendations(
  analytics: MarketingAnalytics,
  previous: MarketingAnalytics | null,
  availablePlatforms: { social: string[]; blog: string[] }
): Promise<MarketingRecommendation[]> {
  if (!process.env.GEMINI_API_KEY) {
    return [];
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Calculate trends if previous analytics available
    const trends = previous ? calculateTrends(analytics, previous) : null;

    const prompt = `You are an expert digital marketing strategist specializing in e-commerce.

AVAILABLE PLATFORMS:
- Social Media: ${availablePlatforms.social.length > 0 ? availablePlatforms.social.join(', ') : 'None configured'}
- Blog Platforms: ${availablePlatforms.blog.length > 0 ? availablePlatforms.blog.join(', ') : 'None configured'}

IMPORTANT: Only suggest strategies for platforms that are available. If a platform is not available, suggest setting it up instead.

Analyze this marketing performance data and suggest 2-3 specific marketing strategies:

CURRENT MARKETING METRICS:
- Email: ${analytics.email.totalSent} sent, ${analytics.email.openRate.toFixed(1)}% open rate, ${analytics.email.clickRate.toFixed(1)}% click rate
- SEO: ${analytics.seo.organicTraffic} organic visitors, avg position ${analytics.seo.avgPosition}
- Content: ${analytics.content.totalPosts} posts, ${analytics.content.avgViewsPerPost} avg views
- Social: ${analytics.social.totalPosts} posts, ${analytics.social.avgEngagementRate.toFixed(1)}% engagement
- Conversion: ${analytics.conversion.conversionRate.toFixed(1)}% rate, $${analytics.conversion.avgOrderValue.toFixed(2)} AOV
- Traffic Sources: Organic ${analytics.traffic.organic}, Direct ${analytics.traffic.direct}, Email ${analytics.traffic.email}, Social ${analytics.traffic.social}
${trends ? `\nTRENDS (vs previous period):\n${trends}` : ''}

For each recommendation:
1. Type: one of [email_campaign, seo_optimization, content_marketing, social_media, promotion, traffic_generation, bundle_creation]
2. Priority: high/medium/low
3. Title: short actionable title
4. Description: why this strategy will work and expected results
5. Expected impact: percentage improvement (be realistic, 10-30% typical)
6. Expected traffic/conversions/revenue: specific numbers if applicable
7. Confidence: 0-1 scale (be conservative)
8. Implementation steps: 3-4 specific steps

Respond in JSON format:
[
  {
    "type": "string",
    "priority": "string",
    "title": "string",
    "description": "string",
    "expectedImpact": number,
    "expectedTraffic": number (optional),
    "expectedConversions": number (optional),
    "expectedRevenue": number (optional),
    "confidence": number,
    "steps": ["string"]
  }
]

Focus on strategies that will have measurable impact. Prioritize quick wins that can be executed autonomously.`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    // Extract JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('[MarketingAgent] Could not parse AI response');
      return [];
    }

    const aiSuggestions = JSON.parse(jsonMatch[0]);

    return aiSuggestions.map((suggestion: any) => ({
      id: uuidv4(),
      type: suggestion.type as MarketingStrategyType,
      priority: suggestion.priority as 'high' | 'medium' | 'low',
      title: suggestion.title,
      description: suggestion.description,
      currentState: 'Current marketing performance',
      proposedState: suggestion.title,
      implementation: {
        campaignType: suggestion.type as MarketingStrategyType,
        steps: suggestion.steps || [],
        estimatedEffort: 'medium',
      },
      metrics: {
        expectedImpact: suggestion.expectedImpact || 15,
        expectedTraffic: suggestion.expectedTraffic,
        expectedConversions: suggestion.expectedConversions,
        expectedRevenue: suggestion.expectedRevenue,
        confidence: suggestion.confidence || 0.75,
        basedOn: ['ai_analysis', 'marketing_data'],
      },
      status: 'pending',
      createdAt: new Date(),
    }));
  } catch (error: any) {
    console.error('[MarketingAgent] AI recommendation generation failed:', error.message);
    return [];
  }
}

/**
 * Calculate trends between current and previous analytics
 */
function calculateTrends(current: MarketingAnalytics, previous: MarketingAnalytics): string {
  const trends: string[] = [];

  // Email trends
  if (previous.email.totalSent > 0) {
    const openRateChange = current.email.openRate - previous.email.openRate;
    trends.push(`Email open rate: ${openRateChange > 0 ? '+' : ''}${openRateChange.toFixed(1)}%`);
  }

  // SEO trends
  if (previous.seo.organicTraffic > 0) {
    const trafficChange = ((current.seo.organicTraffic - previous.seo.organicTraffic) / previous.seo.organicTraffic) * 100;
    trends.push(`Organic traffic: ${trafficChange > 0 ? '+' : ''}${trafficChange.toFixed(1)}%`);
  }

  // Conversion trends
  if (previous.conversion.conversionRate > 0) {
    const conversionChange = current.conversion.conversionRate - previous.conversion.conversionRate;
    trends.push(`Conversion rate: ${conversionChange > 0 ? '+' : ''}${conversionChange.toFixed(1)}%`);
  }

  return trends.join(', ') || 'No significant trends';
}


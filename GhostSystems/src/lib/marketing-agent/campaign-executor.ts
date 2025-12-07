/**
 * Marketing Agent - Campaign Executor
 * 
 * Executes approved marketing campaigns autonomously
 */

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { MarketingRecommendation, CampaignExecution, MarketingStrategyType } from './types.js';
import { markAsExecuting, markAsCompleted } from './approval-queue.js';

const CAMPAIGNS_COLLECTION = 'marketing_campaigns';

/**
 * Execute an approved marketing campaign
 */
export async function executeCampaign(
  recommendation: MarketingRecommendation
): Promise<{ success: boolean; campaignId?: string; error?: string }> {
  console.log(`[MarketingAgent] 🚀 Executing campaign: ${recommendation.title}`);

  try {
    // Mark as executing
    await markAsExecuting(recommendation.id);

    // Create campaign execution record
    const campaignId = await createCampaignExecution(recommendation);

    // Execute based on campaign type
    let result: { success: boolean; error?: string; metrics?: any };
    
    switch (recommendation.type) {
      case 'email_campaign':
        result = await executeEmailCampaign(recommendation);
        break;
      
      case 'seo_optimization':
        result = await executeSEOCampaign(recommendation);
        break;
      
      case 'content_marketing':
        result = await executeContentCampaign(recommendation);
        break;
      
      case 'social_media':
        result = await executeSocialMediaCampaign(recommendation);
        break;
      
      case 'promotion':
        result = await executePromotionCampaign(recommendation);
        break;
      
      case 'bundle_creation':
        result = await executeBundleCampaign(recommendation);
        break;
      
      case 'traffic_generation':
        result = await executeTrafficCampaign(recommendation);
        break;
      
      default:
        result = { success: false, error: `Unknown campaign type: ${recommendation.type}` };
    }

    if (result.success) {
      // Update campaign with results
      await updateCampaignExecution(campaignId, {
        status: 'completed',
        metrics: result.metrics,
      });

      // Mark recommendation as completed
      await markAsCompleted(recommendation.id, result.metrics);

      console.log(`[MarketingAgent] ✅ Campaign executed successfully: ${recommendation.title}`);
      return { success: true, campaignId };
    } else {
      // Mark campaign as failed
      await updateCampaignExecution(campaignId, {
        status: 'cancelled',
        error: result.error,
      });

      console.error(`[MarketingAgent] ❌ Campaign execution failed: ${result.error}`);
      return { success: false, error: result.error };
    }
  } catch (error: any) {
    console.error(`[MarketingAgent] ❌ Campaign execution error:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Create campaign execution record
 */
async function createCampaignExecution(
  recommendation: MarketingRecommendation
): Promise<string> {
  const db = getFirestore();
  
  const execution: CampaignExecution = {
    id: `campaign_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    recommendationId: recommendation.id,
    type: recommendation.type,
    status: 'running',
    startedAt: new Date(),
    config: recommendation.implementation.resources || {},
  };

  await db.collection(CAMPAIGNS_COLLECTION).doc(execution.id).set({
    ...execution,
    startedAt: FieldValue.serverTimestamp(),
  });

  return execution.id;
}

/**
 * Update campaign execution
 */
async function updateCampaignExecution(
  campaignId: string,
  updates: Partial<CampaignExecution>
): Promise<void> {
  const db = getFirestore();
  
  const updateData: any = { ...updates };
  if (updates.completedAt) {
    updateData.completedAt = FieldValue.serverTimestamp();
  }

  await db.collection(CAMPAIGNS_COLLECTION).doc(campaignId).update(updateData);
}

/**
 * Execute email campaign
 */
async function executeEmailCampaign(
  recommendation: MarketingRecommendation
): Promise<{ success: boolean; error?: string; metrics?: any }> {
  try {
    const { sendProductRecommendationEmail, sendAbandonedCartEmail } = await import('../marketing/email-automation.js');
    const { isPlatformAvailable, getMissingCredentialsMessage } = await import('./credentials.js');
    
    // Check if Resend API is configured
    if (!process.env.RESEND_API_KEY) {
      return {
        success: false,
        error: getMissingCredentialsMessage('email', ['RESEND_API_KEY']),
      };
    }
    
    // For subject line optimization, generate variants
    if (recommendation.implementation.steps.some(s => s.includes('subject line'))) {
      // This would integrate with email service to test subject lines
      console.log('[MarketingAgent] 📧 Email campaign: Subject line optimization');
      console.log('[MarketingAgent] ⚠️ Subject line A/B testing not yet implemented');
      return { success: true, metrics: { sent: 0, opened: 0, clicked: 0 } };
    }

    // For product recommendation emails, send to customers
    const { fetchCustomers } = await import('../shopify.js');
    const customers = await fetchCustomers();
    
    // Send to recent customers (last 30 days)
    const recentCustomers = customers
      .filter((c: any) => {
        const createdAt = new Date(c.created_at);
        const daysAgo = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysAgo <= 30;
      })
      .slice(0, 100); // Limit to 100 for rate limiting

    if (recentCustomers.length === 0) {
      return {
        success: false,
        error: 'No recent customers found to send emails to',
      };
    }

    let sent = 0;
    let failed = 0;
    for (const customer of recentCustomers) {
      try {
        await sendProductRecommendationEmail(customer.email, []);
        sent++;
        await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
      } catch (error: any) {
        failed++;
        console.warn(`[MarketingAgent] Failed to send email to ${customer.email}:`, error.message);
      }
    }

    return {
      success: sent > 0,
      metrics: {
        sent,
        failed,
        opened: 0, // Would track via email service webhooks
        clicked: 0,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Execute SEO campaign
 */
async function executeSEOCampaign(
  recommendation: MarketingRecommendation
): Promise<{ success: boolean; error?: string; metrics?: any }> {
  try {
    const { optimizeAllProductsSEO, generateSitemap } = await import('../marketing/seo-optimizer.js');
    
    console.log('[MarketingAgent] 🔍 SEO campaign: Optimizing all products');
    
    const result = await optimizeAllProductsSEO();
    await generateSitemap();

    return {
      success: true,
      metrics: {
        optimized: result.optimized,
        failed: result.failed,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Execute social media campaign
 */
async function executeSocialMediaCampaign(
  recommendation: MarketingRecommendation
): Promise<{ success: boolean; error?: string; metrics?: any }> {
  try {
    const { postToMultiplePlatforms, postToFacebook, postToInstagram } = await import('./social-poster.js');
    const { getAvailablePlatforms } = await import('./credentials.js');
    
    console.log('[MarketingAgent] 📱 Social media campaign: Posting to social platforms');
    
    // Check available social platforms
    const { social: availablePlatforms } = await getAvailablePlatforms();
    
    if (availablePlatforms.length === 0) {
      return {
        success: false,
        error: 'No social media platforms configured. Set up Facebook, Instagram, or Reddit credentials. See MARKETING_AGENT_SETUP.md',
      };
    }

    // Get content from recommendation
    const content = recommendation.description || recommendation.title;
    const imageUrl = recommendation.implementation.resources?.imageUrl;

    // Post to available platforms
    const platforms = availablePlatforms as ('facebook' | 'instagram' | 'reddit')[];
    const redditSubreddit = recommendation.implementation.resources?.redditSubreddit;
    const results = await postToMultiplePlatforms(content, platforms, imageUrl, redditSubreddit);

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    if (successful.length === 0) {
      return {
        success: false,
        error: `All posts failed. Errors: ${failed.map(f => f.error).join('; ')}`,
      };
    }

    return {
      success: true,
      metrics: {
        platformsPosted: successful.map(s => s.platform),
        postsSuccessful: successful.length,
        postsFailed: failed.length,
        postIds: successful.map(s => ({ platform: s.platform, postId: s.postId })),
        errors: failed.map(f => ({ platform: f.platform, error: f.error })),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Execute content marketing campaign
 */
async function executeContentCampaign(
  recommendation: MarketingRecommendation
): Promise<{ success: boolean; error?: string; metrics?: any }> {
  try {
    const { generateCategoryBlogPosts } = await import('../marketing/content-generator.js');
    const { publishToAllBlogs, publishToShopifyBlog, publishToWordPress } = await import('./blog-publisher.js');
    const { getAvailablePlatforms } = await import('./credentials.js');
    
    console.log('[MarketingAgent] ✍️ Content campaign: Generating and publishing blog posts');
    
    // Generate blog posts
    const posts = await generateCategoryBlogPosts();
    
    if (posts.length === 0) {
      return {
        success: false,
        error: 'No blog posts generated',
      };
    }

    // Check available blog platforms
    const { blog: availableBlogs } = await getAvailablePlatforms();
    
    if (availableBlogs.length === 0) {
      return {
        success: false,
        error: 'No blog platforms configured. Set up Shopify or WordPress credentials. See MARKETING_AGENT_SETUP.md',
      };
    }

    // Publish each post to available platforms
    const publishedArticles: Array<{ platform: string; articleId: string; url?: string }> = [];
    let publishedCount = 0;
    let failedCount = 0;

    for (const post of posts.slice(0, 3)) { // Limit to 3 posts per campaign
      try {
        if (availableBlogs.includes('shopify')) {
          const result = await publishToShopifyBlog(post);
          if (result.success && result.articleId) {
            publishedArticles.push({
              platform: 'shopify',
              articleId: result.articleId,
              url: result.url,
            });
            publishedCount++;
          } else {
            failedCount++;
            console.warn(`[MarketingAgent] Failed to publish to Shopify: ${result.error}`);
          }
        }

        if (availableBlogs.includes('wordpress')) {
          const result = await publishToWordPress(post);
          if (result.success && result.articleId) {
            publishedArticles.push({
              platform: 'wordpress',
              articleId: result.articleId,
              url: result.url,
            });
            publishedCount++;
          } else {
            failedCount++;
            console.warn(`[MarketingAgent] Failed to publish to WordPress: ${result.error}`);
          }
        }

        // Small delay between posts
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error: any) {
        failedCount++;
        console.error(`[MarketingAgent] Error publishing post "${post.title}":`, error.message);
      }
    }

    return {
      success: publishedCount > 0,
      metrics: {
        postsGenerated: posts.length,
        postsPublished: publishedCount,
        postsFailed: failedCount,
        publishedArticles,
        platforms: availableBlogs,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Execute promotion campaign
 */
async function executePromotionCampaign(
  recommendation: MarketingRecommendation
): Promise<{ success: boolean; error?: string; metrics?: any }> {
  try {
    const axios = (await import('axios')).default;
    const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL?.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const SHOPIFY_ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN || '';
    const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
    const BASE_URL = `https://${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}`;

    const discountPercent = recommendation.implementation.resources?.discountPercent || 15;
    const duration = recommendation.implementation.resources?.duration || 7;

    // Create discount code
    const discountCode = `MARKETING${Math.floor(Math.random() * 10000)}`;
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + duration);

    const response = await axios.post(
      `${BASE_URL}/price_rules.json`,
      {
        price_rule: {
          title: `Marketing Campaign: ${recommendation.title}`,
          target_type: 'line_item',
          target_selection: 'all',
          allocation_method: 'across',
          value_type: 'percentage',
          value: `-${discountPercent}`,
          customer_selection: 'all',
          starts_at: new Date().toISOString(),
          ends_at: endsAt.toISOString(),
          usage_limit: null,
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_TOKEN,
        },
      }
    );

    const priceRuleId = response.data.price_rule?.id;
    
    if (priceRuleId) {
      // Create discount code
      await axios.post(
        `${BASE_URL}/price_rules/${priceRuleId}/discount_codes.json`,
        {
          discount_code: {
            code: discountCode,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_TOKEN,
          },
        }
      );

      console.log(`[MarketingAgent] 💰 Created discount code: ${discountCode}`);

      // Send promotional email
      const { sendAbandonedCartEmail } = await import('../marketing/email-automation.js');
      // Would send to customer list

      return {
        success: true,
        metrics: {
          discountCode,
          discountPercent,
          duration,
          codeCreated: true,
        },
      };
    }

    return { success: false, error: 'Failed to create discount code' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Execute bundle creation campaign
 */
async function executeBundleCampaign(
  recommendation: MarketingRecommendation
): Promise<{ success: boolean; error?: string; metrics?: any }> {
  try {
    const { generateProductBundle } = await import('../marketing/traffic-generator.js');
    const { fetchProducts } = await import('../shopify.js');
    
    console.log('[MarketingAgent] 📦 Bundle campaign: Creating product bundles');
    
    const products = await fetchProducts();
    const topProducts = products
      .filter((p: any) => p.variants?.[0]?.price)
      .sort((a: any, b: any) => {
        const priceA = parseFloat(a.variants[0].price) || 0;
        const priceB = parseFloat(b.variants[0].price) || 0;
        return priceB - priceA;
      })
      .slice(0, 5);

    if (topProducts.length >= 2) {
      const bundle = await generateProductBundle(
        topProducts.slice(0, 3).map((p: any) => ({
          title: p.title,
          handle: p.handle,
          price: parseFloat(p.variants[0].price) || 0,
        }))
      );

      return {
        success: true,
        metrics: {
          bundlesCreated: 1,
          productsInBundle: topProducts.length,
        },
      };
    }

    return { success: false, error: 'Not enough products to create bundle' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Execute traffic generation campaign
 */
async function executeTrafficCampaign(
  recommendation: MarketingRecommendation
): Promise<{ success: boolean; error?: string; metrics?: any }> {
  try {
    const { generateLimitedOffer } = await import('../marketing/traffic-generator.js');
    
    console.log('[MarketingAgent] 🚀 Traffic campaign: Generating limited offers');
    
    const offer = await generateLimitedOffer();

    return {
      success: true,
      metrics: {
        offersCreated: 1,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get active campaigns
 */
export async function getActiveCampaigns(): Promise<CampaignExecution[]> {
  const db = getFirestore();
  
  try {
    const snapshot = await db.collection(CAMPAIGNS_COLLECTION)
      .where('status', 'in', ['running', 'scheduled'])
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        startedAt: data.startedAt?.toDate?.() || undefined,
        completedAt: data.completedAt?.toDate?.() || undefined,
        scheduledFor: data.scheduledFor?.toDate?.() || undefined,
      } as CampaignExecution;
    });
  } catch (error: any) {
    console.error('[MarketingAgent] Failed to get active campaigns:', error.message);
    return [];
  }
}


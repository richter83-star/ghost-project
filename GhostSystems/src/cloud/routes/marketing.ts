/**
 * Marketing API Routes
 * 
 * Endpoints for triggering marketing campaigns and viewing analytics
 */

import { Router } from 'express';
import {
  optimizeProductSEO,
  optimizeAllProductsSEO,
  generateSitemap,
} from '../../lib/marketing/seo-optimizer.js';
import {
  sendWelcomeEmail,
  sendAbandonedCartEmail,
  sendProductRecommendationEmail,
} from '../../lib/marketing/email-automation.js';
import {
  generateCategoryBlogPost,
  generateProductGuide,
  generateLandingPage,
  generateCategoryBlogPosts,
} from '../../lib/marketing/content-generator.js';
import {
  generateProductShareCard,
  generateAllShareCards,
  generateSocialPost,
} from '../../lib/marketing/social-media.js';
import {
  getAllTrafficStrategies,
  generateProductBundle,
  generateLimitedOffer,
} from '../../lib/marketing/traffic-generator.js';

const router = Router();

/**
 * SEO Optimization
 */
router.post('/seo/optimize-all', async (req, res) => {
  try {
    const result = await optimizeAllProductsSEO();
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/seo/optimize/:productId', async (req, res) => {
  try {
    const result = await optimizeProductSEO(req.params.productId);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/seo/sitemap', async (req, res) => {
  try {
    const sitemap = await generateSitemap();
    res.set('Content-Type', 'application/xml');
    res.send(sitemap);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Email Marketing
 */
router.post('/email/welcome', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    const success = await sendWelcomeEmail(email, name);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/email/abandoned-cart', async (req, res) => {
  try {
    const { email, cartItems } = req.body;
    if (!email || !cartItems) {
      return res.status(400).json({ error: 'Email and cartItems are required' });
    }
    const success = await sendAbandonedCartEmail(email, cartItems);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/email/recommendations', async (req, res) => {
  try {
    const { email, products } = req.body;
    if (!email || !products) {
      return res.status(400).json({ error: 'Email and products are required' });
    }
    const success = await sendProductRecommendationEmail(email, products);
    res.json({ success });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Content Marketing
 */
router.post('/content/category-post', async (req, res) => {
  try {
    const { category, products } = req.body;
    if (!category || !products) {
      return res.status(400).json({ error: 'Category and products are required' });
    }
    const post = await generateCategoryBlogPost(category, products);
    res.json({ success: true, post });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/content/product-guide', async (req, res) => {
  try {
    const { title, type, description } = req.body;
    if (!title || !type) {
      return res.status(400).json({ error: 'Title and type are required' });
    }
    const guide = await generateProductGuide(title, type, description || '');
    res.json({ success: true, guide });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/content/landing-page', async (req, res) => {
  try {
    const { topic, keywords } = req.body;
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }
    const page = await generateLandingPage(topic, keywords || []);
    res.json({ success: true, page });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/content/generate-all', async (req, res) => {
  try {
    const posts = await generateCategoryBlogPosts();
    res.json({ success: true, posts, count: posts.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Social Media
 */
router.post('/social/share-card/:productId', async (req, res) => {
  try {
    const card = await generateProductShareCard(req.params.productId);
    res.json({ success: true, card });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/social/generate-all', async (req, res) => {
  try {
    const result = await generateAllShareCards();
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/social/post/:productId', async (req, res) => {
  try {
    const { platform } = req.body;
    if (!['twitter', 'linkedin', 'facebook'].includes(platform)) {
      return res.status(400).json({ error: 'Platform must be twitter, linkedin, or facebook' });
    }
    // Get product and generate post
    const { getProductById } = await import('../../lib/shopify.js');
    const product = await getProductById(req.params.productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const post = generateSocialPost(product, platform);
    res.json({ success: true, post });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Traffic Generation
 */
router.get('/traffic/strategies', async (req, res) => {
  try {
    const strategies = await getAllTrafficStrategies();
    res.json({ success: true, strategies, count: strategies.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/traffic/bundle', async (req, res) => {
  try {
    const { products } = req.body;
    if (!products || !Array.isArray(products) || products.length < 2) {
      return res.status(400).json({ error: 'At least 2 products are required' });
    }
    const bundle = await generateProductBundle(products);
    res.json({ success: true, bundle });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/traffic/limited-offer/:productId', async (req, res) => {
  try {
    const { discount } = req.body;
    const offer = await generateLimitedOffer(req.params.productId, discount || 20);
    res.json({ success: true, offer });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;


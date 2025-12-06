/**
 * Social Media Integration
 * 
 * Auto-generates social sharing content:
 * - Open Graph images
 * - Shareable product cards
 * - Social media posts
 */

import { getProducts, getProductById } from '../shopify.js';
import { generateImage } from '../gemini.js';

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL || '';
const BASE_STORE_URL = `https://${SHOPIFY_STORE_URL.replace(/^https?:\/\//, '')}`;

export interface SocialShareCard {
  title: string;
  description: string;
  image: string;
  url: string;
  openGraph: {
    'og:title': string;
    'og:description': string;
    'og:image': string;
    'og:url': string;
    'og:type': string;
  };
  twitterCard: {
    'twitter:card': string;
    'twitter:title': string;
    'twitter:description': string;
    'twitter:image': string;
  };
}

/**
 * Generate social share card for a product
 */
export async function generateProductShareCard(productId: string): Promise<SocialShareCard> {
  try {
    const product = await getProductById(productId);
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    // Generate or use existing image
    let shareImage = product.images?.[0]?.src || '';
    
    // If no image, generate one
    if (!shareImage) {
      try {
        shareImage = await generateImage(product.title, product.product_type || 'digital');
      } catch (error) {
        console.warn(`[Social] Could not generate image for ${product.title}`);
      }
    }

    const productUrl = `${BASE_STORE_URL}/products/${product.handle}`;
    const description = (product.body_html || product.title)
      .replace(/<[^>]*>/g, '')
      .substring(0, 200);

    return {
      title: product.title,
      description,
      image: shareImage,
      url: productUrl,
      openGraph: {
        'og:title': product.title,
        'og:description': description,
        'og:image': shareImage,
        'og:url': productUrl,
        'og:type': 'product',
      },
      twitterCard: {
        'twitter:card': 'summary_large_image',
        'twitter:title': product.title,
        'twitter:description': description,
        'twitter:image': shareImage,
      },
    };
  } catch (error: any) {
    console.error(`[Social] Failed to generate share card for ${productId}:`, error.message);
    throw error;
  }
}

/**
 * Generate social media post text for a product
 */
export function generateSocialPost(product: any, platform: 'twitter' | 'linkedin' | 'facebook'): string {
  const title = product.title;
  const price = product.variants?.[0]?.price || '';
  const description = (product.body_html || '')
    .replace(/<[^>]*>/g, '')
    .substring(0, 150);

  const templates = {
    twitter: `🚀 New: ${title}

${description}

💰 $${price}
🔗 ${BASE_STORE_URL}/products/${product.handle}

#AITools #DigitalProducts #Creators`,
    
    linkedin: `Introducing: ${title}

${description}

Perfect for modern creators and businesses looking to streamline their workflow.

Price: $${price}
Learn more: ${BASE_STORE_URL}/products/${product.handle}

#DigitalProducts #AITools #Productivity`,
    
    facebook: `🎉 Check out our latest product: ${title}

${description}

Get yours for just $${price}!

👉 ${BASE_STORE_URL}/products/${product.handle}`,
  };

  return templates[platform] || templates.twitter;
}

/**
 * Generate share cards for all products
 */
export async function generateAllShareCards(): Promise<{
  generated: number;
  failed: number;
}> {
  console.log('[Social] Generating share cards for all products...');

  try {
    const products = await getProducts();
    let generated = 0;
    let failed = 0;

    for (const product of products) {
      try {
        await generateProductShareCard(String(product.id));
        generated++;
        console.log(`[Social] ✅ Generated share card: ${product.title}`);
      } catch (error: any) {
        failed++;
        console.error(`[Social] ❌ Failed: ${product.title} - ${error.message}`);
      }
    }

    return { generated, failed };
  } catch (error: any) {
    console.error('[Social] Failed to generate share cards:', error.message);
    throw error;
  }
}


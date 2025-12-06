/**
 * Content Marketing Generator
 * 
 * Auto-generates marketing content:
 * - Blog posts about product categories
 * - "How to use" guides for products
 * - SEO-optimized landing pages
 */

import { generateDescription } from '../gemini.js';
import { fetchProducts } from '../shopify.js';

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL || '';
const BASE_STORE_URL = `https://${SHOPIFY_STORE_URL.replace(/^https?:\/\//, '')}`;

export interface BlogPost {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  tags: string[];
  publishedAt?: Date;
  seoTitle?: string;
  seoDescription?: string;
}

/**
 * Generate a blog post about a product category
 */
export async function generateCategoryBlogPost(
  category: string,
  products: Array<{ title: string; handle: string; description: string }>
): Promise<BlogPost> {
  const prompt = `Write a comprehensive blog post (800-1000 words) about "${category}" products for digital creators and businesses.

Include:
1. Introduction to ${category} and why it matters
2. Key benefits and use cases
3. How to choose the right ${category} products
4. Tips for getting the most value
5. Conclusion with call-to-action

Make it engaging, SEO-optimized, and include natural mentions of these products:
${products.map(p => `- ${p.title}`).join('\n')}

Format as markdown with proper headings.`;

  try {
    const content = await generateDescription(prompt);
    const slug = category.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    return {
      title: `Complete Guide to ${category} for Modern Creators`,
      slug,
      content,
      excerpt: content.substring(0, 200) + '...',
      tags: [category.toLowerCase(), 'guides', 'digital-products'],
      seoTitle: `Complete Guide to ${category} - DRACANUS AI`,
      seoDescription: `Learn everything about ${category} products for creators. Expert guide with tips, use cases, and recommendations.`,
    };
  } catch (error: any) {
    console.error(`[Content] Failed to generate blog post for ${category}:`, error.message);
    throw error;
  }
}

/**
 * Generate "How to use" guide for a product
 */
export async function generateProductGuide(
  productTitle: string,
  productType: string,
  productDescription: string
): Promise<BlogPost> {
  const prompt = `Write a detailed "How to Use" guide (600-800 words) for: "${productTitle}"

Product Type: ${productType}
Description: ${productDescription.substring(0, 300)}

Include:
1. What this product includes
2. Step-by-step setup instructions
3. Best practices and tips
4. Common use cases
5. Troubleshooting section

Format as markdown with clear headings and actionable steps.`;

  try {
    const content = await generateDescription(prompt);
    const slug = productTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    return {
      title: `How to Use ${productTitle} - Complete Guide`,
      slug: `how-to-use-${slug}`,
      content,
      excerpt: `Learn how to get the most out of ${productTitle}. Step-by-step guide with tips and best practices.`,
      tags: ['how-to', 'guides', productType.toLowerCase()],
      seoTitle: `How to Use ${productTitle} - Step-by-Step Guide`,
      seoDescription: `Complete guide to using ${productTitle}. Learn setup, best practices, and tips for maximum value.`,
    };
  } catch (error: any) {
    console.error(`[Content] Failed to generate guide for ${productTitle}:`, error.message);
    throw error;
  }
}

/**
 * Generate SEO-optimized landing page content
 */
export async function generateLandingPage(
  topic: string,
  targetKeywords: string[]
): Promise<BlogPost> {
  const prompt = `Write an SEO-optimized landing page (1000-1200 words) about "${topic}".

Target keywords: ${targetKeywords.join(', ')}

Include:
1. Compelling headline with primary keyword
2. Problem/solution framework
3. Key benefits (3-5 points)
4. Social proof section
5. Clear call-to-action
6. FAQ section

Make it conversion-focused, SEO-optimized, and engaging. Format as markdown.`;

  try {
    const content = await generateDescription(prompt);
    const slug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    
    return {
      title: topic,
      slug,
      content,
      excerpt: content.substring(0, 200) + '...',
      tags: targetKeywords,
      seoTitle: `${topic} - DRACANUS AI`,
      seoDescription: `Discover ${topic}. Premium solutions for modern creators and businesses.`,
    };
  } catch (error: any) {
    console.error(`[Content] Failed to generate landing page for ${topic}:`, error.message);
    throw error;
  }
}

/**
 * Generate blog posts for all product categories
 */
export async function generateCategoryBlogPosts(): Promise<BlogPost[]> {
  try {
    const products = await fetchProducts();
    
    // Group products by category
    const categories = new Map<string, any[]>();
    products.forEach((product: any) => {
      const category = product.product_type || 'Digital Products';
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category)!.push({
        title: product.title,
        handle: product.handle,
        description: product.body_html || '',
      });
    });

    const blogPosts: BlogPost[] = [];

    for (const [category, categoryProducts] of categories) {
      if (categoryProducts.length > 0) {
        try {
          const post = await generateCategoryBlogPost(category, categoryProducts.slice(0, 5));
          blogPosts.push(post);
          console.log(`[Content] ✅ Generated blog post: ${post.title}`);
        } catch (error: any) {
          console.error(`[Content] ❌ Failed to generate post for ${category}:`, error.message);
        }
      }
    }

    return blogPosts;
  } catch (error: any) {
    console.error('[Content] Failed to generate category blog posts:', error.message);
    throw error;
  }
}


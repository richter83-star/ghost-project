/**
 * Marketing Agent - Blog Publisher
 * 
 * Publishes blog articles to Shopify blog and WordPress.
 */

import axios from 'axios';
import { BlogPost } from '../marketing/content-generator.js';
import { isPlatformAvailable, getMissingCredentialsMessage } from './credentials.js';

export interface PublishResult {
  success: boolean;
  articleId?: string;
  platform: string;
  url?: string;
  error?: string;
}

/**
 * Publish article to Shopify blog
 */
export async function publishToShopifyBlog(
  article: BlogPost
): Promise<PublishResult> {
  const platform = 'shopify';

  // Check credentials
  if (!(await isPlatformAvailable('shopify'))) {
    return {
      success: false,
      platform,
      error: getMissingCredentialsMessage('shopify', [
        'SHOPIFY_STORE_URL',
        'SHOPIFY_ADMIN_API_TOKEN',
      ]),
    };
  }

  try {
    const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL?.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const SHOPIFY_ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN || '';
    const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
    const BASE_URL = `https://${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}`;

    // First, get or create a blog
    let blogId: string | null = null;
    
    try {
      // Try to get existing blogs
      const blogsResponse = await axios.get(`${BASE_URL}/blogs.json`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_TOKEN,
        },
      });

      const blogs = blogsResponse.data?.blogs || [];
      if (blogs.length > 0) {
        blogId = String(blogs[0].id);
      } else {
        // Create a blog if none exists
        const createBlogResponse = await axios.post(
          `${BASE_URL}/blogs.json`,
          {
            blog: {
              title: 'Marketing Blog',
              handle: 'marketing-blog',
            },
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_TOKEN,
            },
          }
        );
        blogId = String(createBlogResponse.data.blog.id);
      }
    } catch (error: any) {
      console.warn('[MarketingAgent] Failed to get/create blog, using default:', error.message);
      // Try to use a default blog ID (you may need to set this manually)
      blogId = process.env.SHOPIFY_BLOG_ID || null;
    }

    if (!blogId) {
      throw new Error('No blog ID available. Create a blog in Shopify Admin or set SHOPIFY_BLOG_ID');
    }

    // Convert markdown to HTML if needed
    let htmlContent = article.content;
    if (!htmlContent.includes('<')) {
      // Assume it's markdown, convert to HTML
      htmlContent = article.content
        .split('\n')
        .map(line => {
          if (line.startsWith('# ')) {
            return `<h1>${line.substring(2)}</h1>`;
          } else if (line.startsWith('## ')) {
            return `<h2>${line.substring(3)}</h2>`;
          } else if (line.startsWith('### ')) {
            return `<h3>${line.substring(4)}</h3>`;
          } else if (line.trim() === '') {
            return '<br>';
          } else {
            return `<p>${line}</p>`;
          }
        })
        .join('\n');
    }

    // Create article
    const articleResponse = await axios.post(
      `${BASE_URL}/blogs/${blogId}/articles.json`,
      {
        article: {
          title: article.title,
          body_html: htmlContent,
          summary: article.excerpt,
          tags: article.tags.join(', '),
          published: true,
          published_at: article.publishedAt?.toISOString() || new Date().toISOString(),
          author: 'Marketing Agent',
          ...(article.seoTitle && { metafields_global_title_tag: article.seoTitle }),
          ...(article.seoDescription && { metafields_global_description_tag: article.seoDescription }),
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_TOKEN,
        },
      }
    );

    const publishedArticle = articleResponse.data.article;
    const articleUrl = `https://${SHOPIFY_STORE_URL}/blogs/${publishedArticle.blog_handle}/${publishedArticle.handle}`;

    console.log(`[MarketingAgent] ✅ Published to Shopify blog: ${publishedArticle.id}`);
    return {
      success: true,
      articleId: String(publishedArticle.id),
      platform,
      url: articleUrl,
    };
  } catch (error: any) {
    console.error('[MarketingAgent] Failed to publish to Shopify blog:', error.message);
    
    let errorMessage = error.message;
    if (error.response?.data?.errors) {
      errorMessage = JSON.stringify(error.response.data.errors);
    }

    return {
      success: false,
      platform,
      error: errorMessage,
    };
  }
}

/**
 * Publish article to WordPress
 */
export async function publishToWordPress(
  article: BlogPost
): Promise<PublishResult> {
  const platform = 'wordpress';

  // Check credentials
  if (!(await isPlatformAvailable('wordpress'))) {
    return {
      success: false,
      platform,
      error: getMissingCredentialsMessage('wordpress', [
        'WORDPRESS_SITE_URL',
        'WORDPRESS_USERNAME',
        'WORDPRESS_APP_PASSWORD',
      ]),
    };
  }

  try {
    const siteUrl = process.env.WORDPRESS_SITE_URL?.replace(/\/$/, '');
    const username = process.env.WORDPRESS_USERNAME;
    const appPassword = process.env.WORDPRESS_APP_PASSWORD;

    if (!siteUrl || !username || !appPassword) {
      throw new Error('WordPress credentials incomplete');
    }

    // Convert markdown to HTML if needed
    let htmlContent = article.content;
    if (!htmlContent.includes('<')) {
      // Basic markdown to HTML conversion
      htmlContent = article.content
        .split('\n')
        .map(line => {
          if (line.startsWith('# ')) {
            return `<h1>${line.substring(2)}</h1>`;
          } else if (line.startsWith('## ')) {
            return `<h2>${line.substring(3)}</h2>`;
          } else if (line.startsWith('### ')) {
            return `<h3>${line.substring(4)}</h3>`;
          } else if (line.trim() === '') {
            return '<br>';
          } else {
            return `<p>${line}</p>`;
          }
        })
        .join('\n');
    }

    // Create Basic Auth header
    const auth = Buffer.from(`${username}:${appPassword}`).toString('base64');

    // Publish to WordPress REST API
    const response = await axios.post(
      `${siteUrl}/wp-json/wp/v2/posts`,
      {
        title: article.title,
        content: htmlContent,
        excerpt: article.excerpt,
        status: 'publish',
        ...(article.tags.length > 0 && { tags: article.tags }),
        ...(article.seoTitle && { meta: { _yoast_wpseo_title: article.seoTitle } }),
        ...(article.seoDescription && { meta: { _yoast_wpseo_metadesc: article.seoDescription } }),
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`,
        },
      }
    );

    const post = response.data;
    const postUrl = post.link;

    console.log(`[MarketingAgent] ✅ Published to WordPress: ${post.id}`);
    return {
      success: true,
      articleId: String(post.id),
      platform,
      url: postUrl,
    };
  } catch (error: any) {
    console.error('[MarketingAgent] Failed to publish to WordPress:', error.message);
    
    let errorMessage = error.message;
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.response?.data?.code) {
      errorMessage = `${error.response.data.code}: ${error.response.data.message || error.message}`;
    }

    // Handle common WordPress errors
    if (error.response?.status === 401) {
      errorMessage = 'Authentication failed. Check WORDPRESS_USERNAME and WORDPRESS_APP_PASSWORD';
    } else if (error.response?.status === 403) {
      errorMessage = 'Permission denied. User needs publish_posts capability';
    } else if (error.response?.status === 404) {
      errorMessage = 'WordPress REST API not found. Check WORDPRESS_SITE_URL';
    }

    return {
      success: false,
      platform,
      error: errorMessage,
    };
  }
}

/**
 * Update a published blog post
 */
export async function updateBlogPost(
  platform: 'shopify' | 'wordpress',
  articleId: string,
  updates: Partial<BlogPost>
): Promise<boolean> {
  try {
    if (platform === 'shopify') {
      const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL?.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const SHOPIFY_ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN || '';
      const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
      const BASE_URL = `https://${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}`;

      // Get blog ID (you may need to track this)
      const blogId = process.env.SHOPIFY_BLOG_ID || '1';

      const updateData: any = {};
      if (updates.title) updateData.title = updates.title;
      if (updates.content) updateData.body_html = updates.content;
      if (updates.excerpt) updateData.summary = updates.excerpt;
      if (updates.tags) updateData.tags = updates.tags.join(', ');

      await axios.put(
        `${BASE_URL}/blogs/${blogId}/articles/${articleId}.json`,
        { article: updateData },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_TOKEN,
          },
        }
      );

      return true;
    } else if (platform === 'wordpress') {
      const siteUrl = process.env.WORDPRESS_SITE_URL?.replace(/\/$/, '');
      const username = process.env.WORDPRESS_USERNAME;
      const appPassword = process.env.WORDPRESS_APP_PASSWORD;

      if (!siteUrl || !username || !appPassword) {
        throw new Error('WordPress credentials missing');
      }

      const auth = Buffer.from(`${username}:${appPassword}`).toString('base64');

      const updateData: any = {};
      if (updates.title) updateData.title = updates.title;
      if (updates.content) updateData.content = updates.content;
      if (updates.excerpt) updateData.excerpt = updates.excerpt;

      await axios.post(
        `${siteUrl}/wp-json/wp/v2/posts/${articleId}`,
        updateData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`,
          },
        }
      );

      return true;
    }

    return false;
  } catch (error: any) {
    console.error(`[MarketingAgent] Failed to update ${platform} post:`, error.message);
    return false;
  }
}

/**
 * Publish to all available blog platforms
 */
export async function publishToAllBlogs(
  article: BlogPost
): Promise<PublishResult[]> {
  const results: PublishResult[] = [];

  // Try Shopify
  if (await isPlatformAvailable('shopify')) {
    const shopifyResult = await publishToShopifyBlog(article);
    results.push(shopifyResult);
  }

  // Try WordPress
  if (await isPlatformAvailable('wordpress')) {
    const wordpressResult = await publishToWordPress(article);
    results.push(wordpressResult);
  }

  return results;
}


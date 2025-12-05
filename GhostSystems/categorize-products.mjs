#!/usr/bin/env node
/**
 * Product Categorization Script
 * Analyzes products and assigns proper categories, types, and collections.
 * 
 * Run: node categorize-products.mjs
 */

import 'dotenv/config';

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL || '';
const SHOPIFY_ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN || '';
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
const BASE_URL = `https://${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}`;

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_TOKEN,
  };
}

// ============================================================================
// CATEGORY DEFINITIONS
// ============================================================================

const CATEGORIES = {
  'prompt-marketing': {
    productType: 'AI Prompt Pack',
    tags: ['prompts', 'marketing', 'copywriting'],
    keywords: ['marketing', 'copywriting', 'ads', 'sales', 'email', 'landing page', 'headline'],
  },
  'prompt-art': {
    productType: 'AI Prompt Pack',
    tags: ['prompts', 'art', 'design'],
    keywords: ['art', 'artistic', 'illustration', 'painting', 'creative', 'visual', 'midjourney', 'dall-e'],
  },
  'prompt-photo': {
    productType: 'AI Prompt Pack',
    tags: ['prompts', 'photography'],
    keywords: ['photo', 'photography', 'realistic', 'portrait', 'landscape', 'headshot'],
  },
  'prompt-business': {
    productType: 'AI Prompt Pack',
    tags: ['prompts', 'business'],
    keywords: ['business', 'productivity', 'strategy', 'planning', 'analysis', 'report'],
  },
  'prompt-writing': {
    productType: 'AI Prompt Pack',
    tags: ['prompts', 'writing'],
    keywords: ['writing', 'content', 'blog', 'article', 'story', 'script'],
  },
  'prompt-social': {
    productType: 'AI Prompt Pack',
    tags: ['prompts', 'social-media'],
    keywords: ['social', 'instagram', 'tiktok', 'twitter', 'linkedin', 'viral'],
  },
  'prompt-code': {
    productType: 'AI Prompt Pack',
    tags: ['prompts', 'coding'],
    keywords: ['code', 'coding', 'programming', 'developer', 'software', 'api'],
  },
  'automation-n8n': {
    productType: 'Automation Kit',
    tags: ['automation', 'n8n'],
    keywords: ['n8n', 'workflow'],
  },
  'automation-zapier': {
    productType: 'Automation Kit',
    tags: ['automation', 'zapier'],
    keywords: ['zapier', 'zap'],
  },
  'automation-make': {
    productType: 'Automation Kit',
    tags: ['automation', 'make'],
    keywords: ['make', 'integromat'],
  },
  'automation-notion': {
    productType: 'Automation Kit',
    tags: ['automation', 'notion'],
    keywords: ['notion', 'database', 'template'],
  },
  'automation-email': {
    productType: 'Automation Kit',
    tags: ['automation', 'email'],
    keywords: ['email automation', 'email sequence', 'newsletter'],
  },
  'automation-ecommerce': {
    productType: 'Automation Kit',
    tags: ['automation', 'ecommerce'],
    keywords: ['shopify', 'ecommerce', 'store', 'order', 'inventory'],
  },
  'bundle': {
    productType: 'Bundle',
    tags: ['bundle', 'value-pack'],
    keywords: ['bundle', 'pack', 'collection', 'mega', 'ultimate'],
  },
};

const DEFAULT_PROMPT = { productType: 'AI Prompt Pack', tags: ['prompts', 'ai'] };
const DEFAULT_AUTO = { productType: 'Automation Kit', tags: ['automation', 'workflow'] };

/**
 * Strip HTML tags and comments from text
 */
function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  
  // Remove HTML comments first
  let cleaned = html.replace(/<!--[\s\S]*?-->/g, '');
  
  // Remove CDATA sections
  cleaned = cleaned.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  
  // Remove all HTML tags (including script, style, etc.)
  cleaned = cleaned.replace(/<[^>]+>/g, '');
  
  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  
  return cleaned.trim();
}

function categorizeProduct(product) {
  const title = (product.title || '').toLowerCase();
  const description = stripHtml(product.body_html || '').toLowerCase();
  const existingType = (product.product_type || '').toLowerCase();
  const combined = `${title} ${description} ${existingType}`;

  let bestMatch = null;
  let bestScore = 0;

  for (const [categoryId, category] of Object.entries(CATEGORIES)) {
    let score = 0;
    for (const keyword of category.keywords) {
      if (combined.includes(keyword)) score += keyword.length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = { categoryId, ...category };
    }
  }

  if (!bestMatch || bestScore < 3) {
    if (combined.includes('prompt') || combined.includes('midjourney')) {
      return { categoryId: 'prompt-general', ...DEFAULT_PROMPT };
    }
    if (combined.includes('automation') || combined.includes('workflow')) {
      return { categoryId: 'automation-general', ...DEFAULT_AUTO };
    }
    return { categoryId: 'prompt-general', ...DEFAULT_PROMPT };
  }

  return bestMatch;
}

async function fetchProducts() {
  const products = [];
  let url = `${BASE_URL}/products.json?limit=50&status=active`;

  while (url) {
    const response = await fetch(url, { headers: getHeaders() });
    const data = await response.json();
    products.push(...data.products);

    const linkHeader = response.headers.get('link') || '';
    const nextMatch = linkHeader.match(/page_info=([^>]+)>; rel="next"/);
    url = nextMatch ? `${BASE_URL}/products.json?limit=50&page_info=${nextMatch[1]}` : null;
  }
  return products;
}

async function fetchCollections() {
  const response = await fetch(`${BASE_URL}/custom_collections.json?limit=250`, { headers: getHeaders() });
  const data = await response.json();
  return data.custom_collections || [];
}

async function createCollection(title) {
  const response = await fetch(`${BASE_URL}/custom_collections.json`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ custom_collection: { title, published: true } }),
  });
  const data = await response.json();
  return data.custom_collection;
}

async function addProductToCollection(collectionId, productId) {
  await fetch(`${BASE_URL}/collects.json`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ collect: { collection_id: collectionId, product_id: productId } }),
  });
}

async function updateProduct(productId, updates) {
  await fetch(`${BASE_URL}/products/${productId}.json`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ product: { id: productId, ...updates } }),
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('\n📁 Product Categorization Tool\n');
  console.log('='.repeat(50));

  if (!SHOPIFY_STORE_URL || !SHOPIFY_ADMIN_API_TOKEN) {
    console.error('Missing Shopify credentials');
    process.exit(1);
  }

  console.log(`Store: ${SHOPIFY_STORE_URL}\n`);

  console.log('Fetching products...');
  const products = await fetchProducts();
  console.log(`Found ${products.length} products\n`);

  console.log('Fetching collections...');
  const existingCollections = await fetchCollections();
  console.log(`Found ${existingCollections.length} existing collections\n`);

  const collectionsToCreate = [
    { title: 'AI Prompt Packs', filter: 'AI Prompt Pack' },
    { title: 'Automation Kits', filter: 'Automation Kit' },
    { title: 'Bundles', filter: 'Bundle' },
    { title: 'Marketing & Ads', filter: 'marketing' },
    { title: 'Art & Design', filter: 'art' },
    { title: 'Photography', filter: 'photography' },
    { title: 'Writing & Content', filter: 'writing' },
    { title: 'Coding & Dev', filter: 'coding' },
  ];

  const collections = {};
  for (const col of collectionsToCreate) {
    const existing = existingCollections.find(c => c.title === col.title);
    if (existing) {
      collections[col.filter] = existing.id;
      console.log(`   Exists: ${col.title}`);
    } else {
      try {
        const newCol = await createCollection(col.title);
        collections[col.filter] = newCol.id;
        console.log(`   Created: ${col.title}`);
        await sleep(500);
      } catch (error) {
        console.log(`   Failed: ${col.title}`);
      }
    }
  }

  console.log('\n' + '-'.repeat(50));
  console.log('\nCategorizing products...\n');

  const stats = {};
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const category = categorizeProduct(product);
    
    console.log(`[${i + 1}/${products.length}] ${product.title}`);
    console.log(`   -> ${category.productType}`);

    stats[category.productType] = (stats[category.productType] || 0) + 1;

    const existingTags = (product.tags || '').split(',').map(t => t.trim()).filter(Boolean);
    const newTags = [...new Set([...existingTags, ...category.tags])];

    try {
      await updateProduct(product.id, {
        product_type: category.productType,
        tags: newTags.join(', '),
      });
      console.log(`   Updated`);

      const mainCollectionId = collections[category.productType];
      if (mainCollectionId) {
        await addProductToCollection(mainCollectionId, product.id);
      }

      for (const tag of category.tags) {
        if (collections[tag]) {
          await addProductToCollection(collections[tag], product.id);
        }
      }
    } catch (error) {
      console.log(`   Failed: ${error.message}`);
    }

    await sleep(500);
  }

  console.log('\n' + '='.repeat(50));
  console.log('CATEGORIZATION COMPLETE');
  console.log('='.repeat(50));
  console.log('\nProducts by type:');
  for (const [type, count] of Object.entries(stats)) {
    console.log(`   ${type}: ${count}`);
  }
  console.log('\nCollections:');
  for (const col of collectionsToCreate) {
    console.log(`   - ${col.title}`);
  }
  console.log('');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});


#!/usr/bin/env node
/**
 * Store Design Script
 * Runs the design agent to optimize store appearance.
 * 
 * Run: node design-store.mjs
 */

import 'dotenv/config';

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL || '';
const SHOPIFY_ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN || '';
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const BASE_URL = `https://${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}`;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent`;

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_TOKEN,
  };
}

// ============================================================================
// SHOPIFY DATA COLLECTION
// ============================================================================

async function fetchProducts() {
  const products = [];
  let url = `${BASE_URL}/products.json?limit=50&status=active`;

  while (url) {
    const response = await fetch(url, { headers: getHeaders() });
    const data = await response.json();
    products.push(...(data.products || []));

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

async function fetchThemes() {
  const response = await fetch(`${BASE_URL}/themes.json`, { headers: getHeaders() });
  const data = await response.json();
  return data.themes || [];
}

async function fetchShopInfo() {
  const response = await fetch(`${BASE_URL}/shop.json`, { headers: getHeaders() });
  const data = await response.json();
  return data.shop || {};
}

// ============================================================================
// DESIGN IMPROVEMENTS
// ============================================================================

async function updateProduct(productId, updates) {
  await fetch(`${BASE_URL}/products/${productId}.json`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ product: { id: productId, ...updates } }),
  });
}

async function updateCollection(collectionId, updates) {
  await fetch(`${BASE_URL}/custom_collections/${collectionId}.json`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ custom_collection: { id: collectionId, ...updates } }),
  });
}

async function generateWithGemini(prompt) {
  const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Gemini error');
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

/**
 * Strip HTML tags and comments from text
 * More robust than simple regex to handle edge cases
 */
function stripHtml(html) {
  if (!html || typeof html !== 'string') return '';
  
  // Remove HTML comments first
  let cleaned = html.replace(/<!--[\s\S]*?-->/g, '');
  
  // Remove CDATA sections
  cleaned = cleaned.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '');
  
  // Remove all HTML tags (including script, style, etc.)
  // Use a more comprehensive regex that handles attributes properly
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// MAIN DESIGN TASKS
// ============================================================================

async function enhanceProductDescriptions(products) {
  console.log('\n📝 Enhancing Product Descriptions...');
  let enhanced = 0;

  for (const product of products) {
    const currentDesc = stripHtml(product.body_html || '');
    
    if (currentDesc.length < 200) {
      console.log(`   → ${product.title} (${currentDesc.length} chars)`);
      
      try {
        const prompt = `Write a compelling product description (200-300 words) for this digital product:
Title: ${product.title}
Type: ${product.product_type || 'Digital Product'}
Current description: ${currentDesc || 'None'}

Create an engaging description that:
- Highlights key benefits and features
- Uses persuasive language
- Explains what the customer gets
- Creates urgency/value perception

Return ONLY the description in HTML format with <p> tags. No other text.`;

        const newDesc = await generateWithGemini(prompt);
        
        if (newDesc && newDesc.length > currentDesc.length) {
          await updateProduct(product.id, { body_html: newDesc });
          enhanced++;
          console.log(`     ✅ Enhanced`);
        }
      } catch (error) {
        console.log(`     ❌ Failed: ${error.message}`);
      }
      
      await sleep(2000);
    }
  }

  console.log(`   Enhanced ${enhanced} products`);
  return enhanced;
}

async function generateMetaDescriptions(products) {
  console.log('\n🔍 Generating SEO Meta Descriptions...');
  let generated = 0;

  for (const product of products) {
    // Check if missing meta description (simplified check)
    const hasShortDesc = stripHtml(product.body_html || '').length < 50;
    
    if (hasShortDesc) {
      try {
        const prompt = `Write an SEO meta description (150-160 characters) for:
Title: ${product.title}
Type: ${product.product_type || 'Digital Product'}

Make it compelling with a call to action. Return ONLY the meta description text.`;

        const metaDesc = await generateWithGemini(prompt);
        
        if (metaDesc) {
          // Update product with meta description in description field
          console.log(`   → ${product.title}: ${metaDesc.slice(0, 60)}...`);
          generated++;
        }
      } catch (error) {
        // Skip errors silently
      }
      
      await sleep(1000);
    }
  }

  console.log(`   Generated ${generated} meta descriptions`);
  return generated;
}

async function enhanceCollections(collections) {
  console.log('\n📁 Enhancing Collection Descriptions...');
  let enhanced = 0;

  for (const collection of collections) {
    const currentDesc = stripHtml(collection.body_html || '');
    
    if (currentDesc.length < 50) {
      console.log(`   → ${collection.title}`);
      
      try {
        const prompt = `Write a brief collection description (50-100 words) for:
Collection: ${collection.title}

Explain what products are in this collection and why customers should browse it.
Return ONLY the description text, no HTML.`;

        const newDesc = await generateWithGemini(prompt);
        
        if (newDesc) {
          await updateCollection(collection.id, { body_html: `<p>${newDesc}</p>` });
          enhanced++;
          console.log(`     ✅ Enhanced`);
        }
      } catch (error) {
        console.log(`     ❌ Failed: ${error.message}`);
      }
      
      await sleep(2000);
    }
  }

  console.log(`   Enhanced ${enhanced} collections`);
  return enhanced;
}

async function generateStoreRecommendations(shop, products, collections, themes) {
  console.log('\n🎨 Generating Design Recommendations...');

  const activeTheme = themes.find(t => t.role === 'main');
  const productsWithImages = products.filter(p => p.images?.length > 0).length;
  const avgDescLength = products.reduce((sum, p) => sum + stripHtml(p.body_html || '').length, 0) / products.length;

  const prompt = `You are an expert Shopify store designer. Analyze this store and provide 5 specific, actionable design recommendations:

STORE: ${shop.name}
- Products: ${products.length} total, ${productsWithImages} with images
- Average description length: ${Math.round(avgDescLength)} characters
- Collections: ${collections.length}
- Theme: ${activeTheme?.name || 'Unknown'}

Product types: ${[...new Set(products.map(p => p.product_type).filter(Boolean))].join(', ')}

Give 5 specific recommendations to make this store look more professional and convert better.
For each recommendation:
1. What to change
2. Why it matters
3. How to implement it (specific Shopify settings or CSS)

Focus on:
- Homepage layout
- Product page optimization
- Color scheme consistency
- Typography improvements
- Trust signals and social proof

Be specific with colors (hex codes), fonts, and exact Shopify settings.`;

  try {
    const recommendations = await generateWithGemini(prompt);
    console.log('\n' + '='.repeat(50));
    console.log('🎨 DESIGN RECOMMENDATIONS');
    console.log('='.repeat(50));
    console.log(recommendations);
    console.log('='.repeat(50) + '\n');
    return recommendations;
  } catch (error) {
    console.log(`   ❌ Failed to generate: ${error.message}`);
    return null;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n🎨 Store Design Optimizer\n');
  console.log('='.repeat(50));

  if (!SHOPIFY_STORE_URL || !SHOPIFY_ADMIN_API_TOKEN) {
    console.error('Missing Shopify credentials');
    process.exit(1);
  }

  if (!GEMINI_API_KEY) {
    console.error('Missing GEMINI_API_KEY');
    process.exit(1);
  }

  console.log(`Store: ${SHOPIFY_STORE_URL}\n`);

  // Collect data
  console.log('📥 Collecting store data...');
  const [shop, products, collections, themes] = await Promise.all([
    fetchShopInfo(),
    fetchProducts(),
    fetchCollections(),
    fetchThemes(),
  ]);

  console.log(`   Shop: ${shop.name}`);
  console.log(`   Products: ${products.length}`);
  console.log(`   Collections: ${collections.length}`);
  console.log(`   Theme: ${themes.find(t => t.role === 'main')?.name || 'Unknown'}`);

  // Run improvements
  const descEnhanced = await enhanceProductDescriptions(products);
  const collEnhanced = await enhanceCollections(collections);
  
  // Generate recommendations
  await generateStoreRecommendations(shop, products, collections, themes);

  // Summary
  console.log('='.repeat(50));
  console.log('📊 DESIGN OPTIMIZATION COMPLETE');
  console.log('='.repeat(50));
  console.log(`   Product descriptions enhanced: ${descEnhanced}`);
  console.log(`   Collection descriptions enhanced: ${collEnhanced}`);
  console.log('\n💡 Review the recommendations above and apply them in Shopify Admin.');
  console.log('   Go to: Online Store > Themes > Customize\n');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});


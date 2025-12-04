#!/usr/bin/env node
/**
 * Regenerate Product Images
 * Replaces placeholder images with AI-generated images.
 * 
 * Run: node regenerate-images.mjs
 */

import 'dotenv/config';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL || '';
const SHOPIFY_ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN || '';
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
const BASE_URL = `https://${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}`;
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_TOKEN,
  };
}

async function fetchAllProducts() {
  const products = [];
  let url = `${BASE_URL}/products.json?limit=50&status=active`;
  
  while (url) {
    const response = await fetch(url, { headers: getHeaders() });
    const data = await response.json();
    products.push(...data.products);
    
    // Get next page from Link header
    const linkHeader = response.headers.get('link') || '';
    const nextMatch = linkHeader.match(/page_info=([^>]+)>; rel="next"/);
    url = nextMatch ? `${BASE_URL}/products.json?limit=50&page_info=${nextMatch[1]}` : null;
  }
  
  return products;
}

async function generateImage(title, productType) {
  const basePrompt = `Professional digital product cover art, clean modern design, high contrast, no text or watermarks`;
  const prompt = `${basePrompt}, sleek digital product visualization, modern tech aesthetic, gradient background, representing "${title}"`;
  
  console.log(`  🎨 Generating image...`);
  
  const response = await fetch(
    `${GEMINI_BASE_URL}/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Generate an image: ${prompt}` }] }],
        generationConfig: { responseModalities: ['Text', 'Image'] }
      })
    }
  );
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error?.message || 'Image generation failed');
  }
  
  const parts = data.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return part.inlineData.data;
    }
  }
  
  throw new Error('No image data in response');
}

async function deleteProductImages(productId) {
  const response = await fetch(
    `${BASE_URL}/products/${productId}/images.json`,
    { headers: getHeaders() }
  );
  const data = await response.json();
  
  for (const image of data.images || []) {
    await fetch(
      `${BASE_URL}/products/${productId}/images/${image.id}.json`,
      { method: 'DELETE', headers: getHeaders() }
    );
  }
}

async function uploadImage(productId, base64Image, title) {
  const response = await fetch(
    `${BASE_URL}/products/${productId}/images.json`,
    {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        image: {
          attachment: base64Image,
          filename: `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`,
        }
      })
    }
  );
  
  const data = await response.json();
  return !!data.image?.id;
}

function isPlaceholder(url) {
  return url.includes('placeholder') || 
         url.includes('via.placeholder') || 
         url.includes('source.unsplash') ||
         url.includes('picsum.photos') ||
         url.includes('placehold.');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('\n🎨 Product Image Regeneration Tool\n');
  console.log('═'.repeat(50));
  
  if (!SHOPIFY_STORE_URL || !SHOPIFY_ADMIN_API_TOKEN) {
    console.error('❌ Missing SHOPIFY_STORE_URL or SHOPIFY_ADMIN_API_TOKEN');
    process.exit(1);
  }
  
  if (!GEMINI_API_KEY) {
    console.error('❌ Missing GEMINI_API_KEY');
    process.exit(1);
  }
  
  console.log(`📦 Store: ${SHOPIFY_STORE_URL}`);
  console.log(`🤖 AI Images: Enabled\n`);
  
  // Fetch products
  console.log('📥 Fetching products...');
  const products = await fetchAllProducts();
  console.log(`   Found ${products.length} products\n`);
  
  // Find products needing images
  const needsImages = products.filter(p => {
    if (!p.images || p.images.length === 0) return true;
    return p.images.some(img => isPlaceholder(img.src));
  });
  
  console.log(`🔍 Products needing new images: ${needsImages.length}`);
  
  if (needsImages.length === 0) {
    console.log('✅ All products have proper images!');
    return;
  }
  
  console.log('\n' + '─'.repeat(50));
  
  let success = 0, failed = 0;
  
  for (let i = 0; i < needsImages.length; i++) {
    const product = needsImages[i];
    console.log(`\n[${i + 1}/${needsImages.length}] ${product.title}`);
    
    try {
      const base64 = await generateImage(product.title, product.product_type || 'digital');
      console.log(`  ✅ Generated (${Math.round(base64.length / 1024)}KB)`);
      
      if (product.images?.length > 0) {
        console.log('  🗑️  Removing old images...');
        await deleteProductImages(product.id);
      }
      
      console.log('  📤 Uploading...');
      const uploaded = await uploadImage(product.id, base64, product.title);
      
      if (uploaded) {
        console.log('  ✅ Success!');
        success++;
      } else {
        console.log('  ⚠️  Upload failed');
        failed++;
      }
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      failed++;
      
      if (error.message.includes('429') || error.message.includes('quota')) {
        console.log('  ⏳ Rate limited - waiting 60s...');
        await sleep(60000);
      }
    }
    
    // Delay between products
    if (i < needsImages.length - 1) {
      await sleep(3000);
    }
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log('📊 Summary:');
  console.log(`   ✅ Success: ${success}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log('\n');
}

main().catch(console.error);


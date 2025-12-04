#!/usr/bin/env tsx
/**
 * Regenerate Product Images
 * 
 * Replaces placeholder images with AI-generated images for all products.
 * Run: npm run regenerate:images
 */

import 'dotenv/config';
import axios from 'axios';
import { generateImage } from '../lib/gemini.js';

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

interface ShopifyProduct {
  id: number;
  title: string;
  product_type: string;
  images: Array<{ id: number; src: string }>;
}

async function fetchAllProducts(): Promise<ShopifyProduct[]> {
  const products: ShopifyProduct[] = [];
  let pageInfo: string | null = null;
  
  do {
    const url = pageInfo 
      ? `${BASE_URL}/products.json?limit=50&page_info=${pageInfo}`
      : `${BASE_URL}/products.json?limit=50&status=active`;
    
    const response = await axios.get(url, { headers: getHeaders() });
    products.push(...response.data.products);
    
    // Get next page from Link header
    const linkHeader = response.headers['link'] || '';
    const nextMatch = linkHeader.match(/page_info=([^>]+)>; rel="next"/);
    pageInfo = nextMatch ? nextMatch[1] : null;
    
  } while (pageInfo);
  
  return products;
}

async function deleteProductImages(productId: number): Promise<void> {
  const response = await axios.get(
    `${BASE_URL}/products/${productId}/images.json`,
    { headers: getHeaders() }
  );
  
  for (const image of response.data.images) {
    await axios.delete(
      `${BASE_URL}/products/${productId}/images/${image.id}.json`,
      { headers: getHeaders() }
    );
  }
}

async function uploadProductImage(productId: number, base64Image: string, title: string): Promise<boolean> {
  try {
    const response = await axios.post(
      `${BASE_URL}/products/${productId}/images.json`,
      {
        image: {
          attachment: base64Image,
          filename: `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`,
        },
      },
      { headers: getHeaders(), timeout: 60000 }
    );
    
    return !!response.data?.image?.id;
  } catch (error: any) {
    console.error(`  ❌ Failed to upload: ${error.message}`);
    return false;
  }
}

function isPlaceholderImage(imageUrl: string): boolean {
  // Detect common placeholder image sources
  return (
    imageUrl.includes('placeholder.com') ||
    imageUrl.includes('via.placeholder') ||
    imageUrl.includes('source.unsplash') ||
    imageUrl.includes('picsum.photos') ||
    imageUrl.includes('placehold.') ||
    imageUrl.includes('fakeimg.')
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('\n🎨 Product Image Regeneration Tool\n');
  console.log('═'.repeat(50));
  
  if (!SHOPIFY_STORE_URL || !SHOPIFY_ADMIN_API_TOKEN) {
    console.error('❌ Missing SHOPIFY_STORE_URL or SHOPIFY_ADMIN_API_TOKEN');
    process.exit(1);
  }
  
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ Missing GEMINI_API_KEY for AI image generation');
    process.exit(1);
  }
  
  console.log(`📦 Store: ${SHOPIFY_STORE_URL}`);
  console.log(`🤖 AI Images: Enabled\n`);
  
  // Fetch all products
  console.log('📥 Fetching products from Shopify...');
  const products = await fetchAllProducts();
  console.log(`   Found ${products.length} products\n`);
  
  // Filter products that need new images
  const productsNeedingImages = products.filter(p => {
    if (p.images.length === 0) return true;
    return p.images.some(img => isPlaceholderImage(img.src));
  });
  
  console.log(`🔍 Products needing new images: ${productsNeedingImages.length}`);
  
  if (productsNeedingImages.length === 0) {
    console.log('✅ All products have proper images!');
    return;
  }
  
  console.log('\n' + '─'.repeat(50));
  
  let success = 0;
  let failed = 0;
  
  for (let i = 0; i < productsNeedingImages.length; i++) {
    const product = productsNeedingImages[i];
    console.log(`\n[${i + 1}/${productsNeedingImages.length}] ${product.title}`);
    
    try {
      // Generate AI image
      console.log('  🎨 Generating AI image...');
      const base64Image = await generateImage(product.title, product.product_type || 'digital');
      
      // Delete existing placeholder images
      if (product.images.length > 0) {
        console.log('  🗑️  Removing old placeholder images...');
        await deleteProductImages(product.id);
      }
      
      // Upload new AI image
      console.log('  📤 Uploading AI image to Shopify...');
      const uploaded = await uploadProductImage(product.id, base64Image, product.title);
      
      if (uploaded) {
        console.log('  ✅ Success!');
        success++;
      } else {
        console.log('  ⚠️  Upload failed');
        failed++;
      }
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
      failed++;
      
      // If rate limited, wait and continue
      if (error.message.includes('429') || error.message.includes('quota')) {
        console.log('  ⏳ Rate limited - waiting 60 seconds...');
        await sleep(60000);
      }
    }
    
    // Delay between products to avoid rate limits
    if (i < productsNeedingImages.length - 1) {
      await sleep(3000); // 3 second delay
    }
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log('📊 Summary:');
  console.log(`   ✅ Success: ${success}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📦 Total: ${productsNeedingImages.length}`);
  console.log('\n');
}

main().catch(console.error);


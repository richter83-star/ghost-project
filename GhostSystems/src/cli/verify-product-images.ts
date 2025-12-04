/**
 * Verify Product Images Script
 * 
 * Checks if products in Shopify have images and reports statistics
 */

import 'dotenv/config';
import { fetchProducts } from '../lib/shopify.js';

async function main() {
  console.log('🔍 Verifying Product Images in Shopify...\n');

  const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL || '';
  const SHOPIFY_ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN || '';

  if (!SHOPIFY_STORE_URL || !SHOPIFY_ADMIN_API_TOKEN) {
    console.error('❌ Missing Shopify credentials. Set SHOPIFY_STORE_URL and SHOPIFY_ADMIN_API_TOKEN');
    process.exit(1);
  }

  try {
    const products = await fetchProducts();
    console.log(`📦 Found ${products.length} total products\n`);

    let withImages = 0;
    let withoutImages = 0;
    let withMultipleImages = 0;
    const missingImages: Array<{ id: string; title: string }> = [];

    for (const product of products) {
      const imageCount = product.images?.length || 0;
      
      if (imageCount === 0) {
        withoutImages++;
        missingImages.push({
          id: product.id,
          title: product.title || 'Untitled',
        });
      } else {
        withImages++;
        if (imageCount > 1) {
          withMultipleImages++;
        }
      }
    }

    console.log('📊 Image Statistics:');
    console.log(`  ✅ Products with images: ${withImages} (${((withImages / products.length) * 100).toFixed(1)}%)`);
    console.log(`  ❌ Products without images: ${withoutImages} (${((withoutImages / products.length) * 100).toFixed(1)}%)`);
    console.log(`  🖼️  Products with multiple images: ${withMultipleImages}`);
    console.log('');

    if (missingImages.length > 0) {
      console.log(`⚠️  Products Missing Images (${missingImages.length}):`);
      missingImages.slice(0, 10).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.title} (ID: ${p.id})`);
      });
      if (missingImages.length > 10) {
        console.log(`  ... and ${missingImages.length - 10} more`);
      }
      console.log('');
      console.log('💡 To fix missing images, run: npm run fix:shopify');
    } else {
      console.log('✅ All products have images!');
    }

    // Sample check: verify first few products have valid image URLs
    console.log('\n🔍 Sample Image URL Verification:');
    const sampleProducts = products.slice(0, 5);
    for (const product of sampleProducts) {
      const image = product.images?.[0];
      if (image) {
        const url = image.src || image.url || '';
        const isValid = url.startsWith('http');
        console.log(`  ${isValid ? '✅' : '❌'} ${product.title?.substring(0, 40)}...`);
        if (isValid) {
          console.log(`      URL: ${url.substring(0, 60)}...`);
        } else {
          console.log(`      ⚠️  Invalid or missing URL`);
        }
      } else {
        console.log(`  ❌ ${product.title?.substring(0, 40)}... - No image`);
      }
    }

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error verifying products:', error.message);
    if (error.response?.data) {
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();


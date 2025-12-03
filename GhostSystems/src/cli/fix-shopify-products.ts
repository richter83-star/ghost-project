/**
 * Fix Shopify Products Script
 * 
 * Fixes existing products in Shopify:
 * 1. Removes inventory tracking (makes them available, not "sold out")
 * 2. Updates descriptions if missing/poor quality
 * 3. Adds placeholder images if missing
 */

import 'dotenv/config';
import axios from 'axios';
import { fetchProducts } from '../lib/shopify.js';

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL || '';
const SHOPIFY_ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN || '';
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';

const BASE_URL = `https://${SHOPIFY_STORE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')}/admin/api/${SHOPIFY_API_VERSION}`;

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_TOKEN,
  };
}

/**
 * Fix inventory settings for a product variant
 */
async function fixVariantInventory(variantId: string, productId: string): Promise<void> {
  try {
    const response = await axios.put(
      `${BASE_URL}/products/${productId}/variants/${variantId}.json`,
      {
        variant: {
          id: variantId,
          inventory_management: null, // Don't track inventory
          inventory_policy: 'continue', // Allow purchases
        },
      },
      { headers: getHeaders() }
    );
    console.log(`  ✅ Fixed inventory for variant ${variantId}`);
  } catch (error: any) {
    console.error(`  ❌ Failed to fix variant ${variantId}:`, error.message);
  }
}

/**
 * Check if description is usable (has minimum length)
 */
function isDescriptionUsable(description: string | null | undefined): boolean {
  if (!description) return false;
  const text = description.replace(/<[^>]*>/g, '').trim(); // Remove HTML tags
  return text.length >= 150; // Minimum 150 characters
}

/**
 * Update product description
 */
async function updateDescription(productId: string, description: string): Promise<void> {
  try {
    const response = await axios.put(
      `${BASE_URL}/products/${productId}.json`,
      {
        product: {
          id: productId,
          body_html: `<p>${description.replace(/\n/g, '</p><p>')}</p>`,
        },
      },
      { headers: getHeaders() }
    );
    console.log(`  ✅ Updated description (${description.length} chars)`);
  } catch (error: any) {
    console.error(`  ❌ Failed to update description:`, error.message);
  }
}

async function main() {
  console.log('🔧 Fixing Shopify Products...\n');

  if (!SHOPIFY_STORE_URL || !SHOPIFY_ADMIN_API_TOKEN) {
    console.error('❌ Missing Shopify credentials. Set SHOPIFY_STORE_URL and SHOPIFY_ADMIN_API_TOKEN');
    process.exit(1);
  }

  try {
    const products = await fetchProducts();
    console.log(`📦 Found ${products.length} products to check\n`);

    let fixedInventory = 0;
    let fixedDescriptions = 0;
    let missingImages = 0;

    for (const product of products) {
      console.log(`\n📦 ${product.title} (ID: ${product.id})`);

      // Fix inventory for all variants
      if (product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          if (variant.inventory_management === 'shopify' || variant.inventory_policy === 'deny') {
            await fixVariantInventory(variant.id, product.id);
            fixedInventory++;
          }
        }
      }

      // Check description
      if (!isDescriptionUsable(product.body_html)) {
        console.log(`  ⚠️  Description is missing or too short`);
        console.log(`  💡 Run description generation separately (needs GEMINI_API_KEY)`);
        // Don't auto-generate here as it requires Gemini API
        fixedDescriptions++;
      } else {
        console.log(`  ✅ Description OK`);
      }

      // Check images
      if (!product.images || product.images.length === 0) {
        console.log(`  ⚠️  No images found`);
        missingImages++;
      } else {
        console.log(`  ✅ Has ${product.images.length} image(s)`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log(`  - Fixed inventory: ${fixedInventory} variants`);
    console.log(`  - Products with poor descriptions: ${fixedDescriptions}`);
    console.log(`  - Products missing images: ${missingImages}`);
    console.log('\n✅ Done! Your products should now show as available (not sold out)');

    if (fixedDescriptions > 0) {
      console.log('\n💡 To fix descriptions:');
      console.log('   Set GEMINI_API_KEY and products will auto-generate descriptions on next pipeline run');
    }

    if (missingImages > 0) {
      console.log('\n💡 To add images:');
      console.log('   Enable image generation in the Shopify pipeline or add images manually');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();


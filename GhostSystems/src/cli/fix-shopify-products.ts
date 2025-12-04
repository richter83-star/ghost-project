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
import { getBestPlaceholderImage } from '../lib/image-placeholder.js';
import { generateDescription } from '../lib/gemini.js';
import { Readable } from 'stream';

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
 * Hash string to create consistent image selection
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % 1000;
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
          inventory_quantity: null, // Clear quantity
        },
      },
      { headers: getHeaders() }
    );
    console.log(`  ✅ Fixed inventory for variant ${variantId}`);
  } catch (error: any) {
    console.error(`  ❌ Failed to fix variant ${variantId}:`, error.message);
    if (error.response?.data) {
      console.error(`  📋 Error details:`, JSON.stringify(error.response.data, null, 2));
    }
  }
}

/**
 * Update product category/type
 */
async function updateProductCategory(productId: string, productType: string): Promise<void> {
  try {
    // Map product types to Shopify-friendly categories
    const categoryMap: Record<string, string> = {
      'prompt_pack': 'Digital Artwork',
      'automation_kit': 'Digital Services',
      'bundle': 'Digital Bundle',
    };
    
    const category = categoryMap[productType] || 'Digital Goods';
    
    const response = await axios.put(
      `${BASE_URL}/products/${productId}.json`,
      {
        product: {
          id: productId,
          product_type: category,
        },
      },
      { headers: getHeaders() }
    );
    console.log(`  ✅ Updated category to: ${category}`);
  } catch (error: any) {
    console.error(`  ❌ Failed to update category:`, error.message);
  }
}

/**
 * Safely extract plain text from HTML for length validation
 * Removes HTML tags and decodes HTML entities to prevent injection
 */
function extractPlainText(html: string): string {
  if (!html || typeof html !== 'string') return '';
  
  // Step 1: Remove all HTML tags
  let text = html.replace(/<[^>]*>/g, '');
  
  // Step 2: Decode HTML entities to get plain text (prevents injection)
  const entityMap: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#039;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&hellip;': '...',
    '&mdash;': '—',
    '&ndash;': '–',
  };
  
  // Replace named entities
  Object.entries(entityMap).forEach(([entity, char]) => {
    text = text.replace(new RegExp(entity, 'gi'), char);
  });
  
  // Replace numeric entities (&#123; and &#x7B;)
  text = text.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  text = text.replace(/&#x([a-f\d]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  // Remove any remaining unrecognized entities
  text = text.replace(/&[a-z]+;/gi, '');
  
  return text.trim();
}

/**
 * Check if description is usable (has minimum length)
 */
function isDescriptionUsable(description: string | null | undefined): boolean {
  if (!description) return false;
  // Extract plain text safely (no HTML tags or entities)
  const plainText = extractPlainText(description);
  return plainText.length >= 150; // Minimum 150 characters
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

/**
 * Download image from URL and convert to base64 properly
 */
async function downloadImageAsBase64(imageUrl: string): Promise<{ base64: string; contentType: string }> {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ShopifyBot/1.0)',
      },
    });
    
    // Properly convert arraybuffer to buffer
    const buffer = Buffer.from(response.data);
    const base64 = buffer.toString('base64');
    const contentType = response.headers['content-type'] || 'image/jpeg';
    
    return { base64, contentType };
  } catch (error: any) {
    console.error(`  ⚠️  Failed to download image: ${error.message}`);
    throw error;
  }
}

/**
 * Add image to product - try multiple methods
 */
async function addProductImage(productId: string, imageUrl: string): Promise<void> {
  // Method 1: Try direct URL first (simplest, most reliable)
  try {
    console.log(`  📤 Method 1: Direct URL upload...`);
    const response = await axios.post(
      `${BASE_URL}/products/${productId}/images.json`,
      {
        image: {
          src: imageUrl,
        },
      },
      { 
        headers: getHeaders(),
        timeout: 30000, // 30 second timeout for Shopify to fetch
      }
    );
    
    if (response.data?.image?.id) {
      console.log(`  ✅ Image added successfully via URL`);
      return;
    }
  } catch (urlError: any) {
    console.log(`  ⚠️  URL upload failed: ${urlError.response?.status || urlError.message}`);
  }
  
  // Method 2: Download and upload as base64
  try {
    console.log(`  📥 Method 2: Downloading and uploading as base64...`);
    const { base64, contentType } = await downloadImageAsBase64(imageUrl);
    
    // Determine file extension from content type
    let ext = 'jpg';
    if (contentType.includes('png')) ext = 'png';
    else if (contentType.includes('gif')) ext = 'gif';
    else if (contentType.includes('webp')) ext = 'webp';
    
    const response = await axios.post(
      `${BASE_URL}/products/${productId}/images.json`,
      {
        image: {
          attachment: base64,
          filename: `product-${productId}.${ext}`,
        },
      },
      { headers: getHeaders() }
    );
    
    if (response.data?.image?.id) {
      console.log(`  ✅ Image added successfully via base64`);
      return;
    }
  } catch (base64Error: any) {
    console.log(`  ⚠️  Base64 upload failed: ${base64Error.response?.status || base64Error.message}`);
    if (base64Error.response?.data) {
      console.error(`  📋 Error:`, JSON.stringify(base64Error.response.data, null, 2));
    }
  }
  
  // If both methods failed, throw error
  throw new Error('All image upload methods failed. Shopify may not be able to fetch the image URL.');
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
    let improvedDescriptions = 0;
    let addedImages = 0;
    let fixedCategories = 0;

    for (const product of products) {
      console.log(`\n📦 ${product.title} (ID: ${product.id})`);

      // Fix inventory for all variants
      if (product.variants && product.variants.length > 0) {
        for (const variant of product.variants) {
          if (variant.inventory_management === 'shopify' || variant.inventory_policy === 'deny' || variant.inventory_management !== null) {
            await fixVariantInventory(variant.id, product.id);
            fixedInventory++;
          }
        }
      }

      // Fix category if missing or generic
      const productType = product.product_type || '';
      if (!productType || productType === 'Digital Goods' || productType.length < 3) {
        // Try to infer from title or set default
        let inferredType = 'Digital Artwork';
        if (product.title?.toLowerCase().includes('prompt')) {
          inferredType = 'Digital Artwork';
        } else if (product.title?.toLowerCase().includes('automation') || product.title?.toLowerCase().includes('kit')) {
          inferredType = 'Digital Services';
        } else if (product.title?.toLowerCase().includes('bundle')) {
          inferredType = 'Digital Bundle';
        }
        await updateProductCategory(product.id, inferredType);
        fixedCategories++;
      }

      // Check and improve description
      if (!isDescriptionUsable(product.body_html)) {
        console.log(`  ⚠️  Description is missing or too short, generating better one...`);
        try {
          const newDescription = await generateDescription(
            product.title,
            product.product_type || 'digital'
          );
          await updateDescription(product.id, newDescription);
          console.log(`  ✅ Generated and updated description (${newDescription.length} chars)`);
          improvedDescriptions++;
        } catch (error: any) {
          if (error.message.includes('GEMINI_API_KEY')) {
            console.log(`  ⚠️  GEMINI_API_KEY not set, skipping description generation`);
          } else {
            console.log(`  ⚠️  Could not generate description: ${error.message}`);
          }
        }
      } else {
        console.log(`  ✅ Description OK`);
      }

      // Check and fix images
      if (!product.images || product.images.length === 0) {
        console.log(`  ⚠️  No images found, adding placeholder...`);
        let imageAdded = false;
        let attempts = 0;
        const maxAttempts = 3;
        
        // Try multiple placeholder services if one fails
        const placeholderServices = [
          () => getBestPlaceholderImage(product.title, product.product_type || 'digital'),
          () => `https://picsum.photos/seed/${hashString(product.title)}/800/800`,
          () => `https://images.unsplash.com/photo-${Math.floor(Math.random() * 1000000)}?w=800&h=800&fit=crop`,
        ];
        
        while (!imageAdded && attempts < maxAttempts) {
          try {
            const placeholderUrl = placeholderServices[attempts]();
            console.log(`  📷 Attempt ${attempts + 1}/${maxAttempts}: Adding image...`);
            await addProductImage(product.id, placeholderUrl);
            console.log(`  ✅ Successfully added image`);
            addedImages++;
            imageAdded = true;
            // Wait a bit to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error: any) {
            attempts++;
            console.error(`  ❌ Attempt ${attempts} failed:`, error.message);
            if (error.response?.data) {
              console.error(`  📋 Error details:`, JSON.stringify(error.response.data, null, 2));
            }
            if (attempts < maxAttempts) {
              console.log(`  🔄 Trying next method...`);
              await new Promise(resolve => setTimeout(resolve, 500));
            } else {
              console.error(`  ❌ All image upload attempts failed for this product`);
            }
          }
        }
      } else {
        console.log(`  ✅ Has ${product.images.length} image(s)`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Summary:');
    console.log(`  ✅ Fixed inventory: ${fixedInventory} variants (products now available)`);
    console.log(`  ✅ Added images: ${addedImages} products (placeholder images)`);
    console.log(`  ✅ Improved descriptions: ${improvedDescriptions} products (AI-generated)`);
    console.log(`  ✅ Fixed categories: ${fixedCategories} products`);
    console.log('\n✅ Done! Your products should now:');
    console.log('   - Show as available (not "sold out")');
    console.log('   - Have placeholder images');
    console.log('   - Have detailed, AI-generated descriptions');
    console.log('   - Have proper categories set');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();


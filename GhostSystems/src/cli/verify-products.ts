#!/usr/bin/env tsx
/**
 * Product Verification CLI
 * 
 * Scans all products and verifies they have real, deliverable content.
 * Can auto-fix products by generating missing content.
 * 
 * Usage:
 *   npm run verify:products              # Scan and report
 *   npm run verify:products -- --fix     # Scan and auto-fix
 *   npm run verify:products -- --shopify # Scan Shopify products
 */

import 'dotenv/config';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import axios from 'axios';
import {
  verifyProduct,
  verifyAndFix,
  updateProductWithContent,
  getContentType,
  ProductData,
  VerificationResult,
} from '../lib/product-verifier.js';
import { generateProductContent } from '../lib/content-generator.js';

// ============================================================================
// CONFIGURATION
// ============================================================================

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL || '';
const SHOPIFY_ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN || '';
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
const BASE_URL = `https://${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}`;

let db: FirebaseFirestore.Firestore | null = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

function initFirebase(): boolean {
  if (db) return true;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_JSON not set');
    return false;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    if (!getApps().length) {
      initializeApp({ credential: cert(serviceAccount as any) });
    }
    db = getFirestore();
    return true;
  } catch (error: any) {
    console.error('❌ Failed to initialize Firebase:', error.message);
    return false;
  }
}

function getShopifyHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_TOKEN,
  };
}

// ============================================================================
// SHOPIFY FUNCTIONS
// ============================================================================

async function fetchShopifyProducts(): Promise<ProductData[]> {
  if (!SHOPIFY_STORE_URL || !SHOPIFY_ADMIN_API_TOKEN) {
    throw new Error('Shopify credentials not configured');
  }

  const products: ProductData[] = [];
  let url: string | null = `${BASE_URL}/products.json?limit=50&status=active`;

  while (url) {
    const response = await axios.get(url, { headers: getShopifyHeaders() });
    
    for (const p of response.data.products) {
      products.push({
        id: String(p.id),
        title: p.title,
        description: p.body_html?.replace(/<[^>]*>/g, '') || '',
        productType: p.product_type,
        price: parseFloat(p.variants?.[0]?.price || '0'),
        images: p.images,
        hasContent: p.tags?.includes('has-content') || false,
      });
    }

    // Get next page from Link header
    const linkHeader = response.headers['link'] || '';
    const nextMatch = linkHeader.match(/page_info=([^>]+)>; rel="next"/);
    url = nextMatch ? `${BASE_URL}/products.json?limit=50&page_info=${nextMatch[1]}` : null;
  }

  return products;
}

async function updateShopifyProductTags(productId: string, tags: string): Promise<void> {
  await axios.put(
    `${BASE_URL}/products/${productId}.json`,
    { product: { id: productId, tags } },
    { headers: getShopifyHeaders() }
  );
}

// ============================================================================
// FIRESTORE FUNCTIONS
// ============================================================================

async function fetchFirestoreProducts(): Promise<ProductData[]> {
  if (!db) {
    throw new Error('Firestore not initialized');
  }

  const collection = process.env.FIRESTORE_JOBS_COLLECTION || 'products';
  const snapshot = await db.collection(collection).get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as ProductData[];
}

// ============================================================================
// VERIFICATION FUNCTIONS
// ============================================================================

async function verifyAllProducts(
  products: ProductData[],
  autoFix: boolean,
  source: 'firestore' | 'shopify'
): Promise<void> {
  console.log(`\n📋 Verifying ${products.length} products from ${source}...\n`);
  console.log('─'.repeat(60));

  let valid = 0;
  let invalid = 0;
  let fixed = 0;
  const issues: Array<{ title: string; issues: string[] }> = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    console.log(`\n[${i + 1}/${products.length}] ${product.title}`);

    if (autoFix) {
      const { result, fixed: wasFixed, content } = await verifyAndFix(product);

      if (wasFixed && content) {
        fixed++;
        console.log(`   ✅ FIXED - Generated ${content.type} content`);

        // Update storage
        if (source === 'firestore' && db && product.id) {
          const collection = process.env.FIRESTORE_JOBS_COLLECTION || 'products';
          await updateProductWithContent(product.id, content, collection);
        }
        if (source === 'shopify' && product.id) {
          // Add tag to indicate content was generated
          const currentTags = (product as any).tags || '';
          const newTags = currentTags ? `${currentTags}, has-content` : 'has-content';
          await updateShopifyProductTags(product.id, newTags);
        }
      } else if (result.isValid) {
        valid++;
        console.log('   ✅ VALID');
      } else {
        invalid++;
        console.log(`   ❌ INVALID - ${result.issues.join(', ')}`);
        issues.push({ title: product.title, issues: result.issues });
      }
    } else {
      const result = await verifyProduct(product);

      if (result.isValid) {
        valid++;
        console.log('   ✅ VALID');
      } else {
        invalid++;
        console.log(`   ❌ INVALID - ${result.issues.join(', ')}`);
        issues.push({ title: product.title, issues: result.issues });
      }
    }

    // Rate limiting
    if (i < products.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('═'.repeat(60));
  console.log(`   Total Products: ${products.length}`);
  console.log(`   ✅ Valid: ${valid}`);
  console.log(`   ❌ Invalid: ${invalid}`);
  if (autoFix) {
    console.log(`   🔧 Fixed: ${fixed}`);
  }
  console.log('');

  if (issues.length > 0) {
    console.log('❌ PRODUCTS WITH ISSUES:');
    console.log('─'.repeat(60));
    for (const item of issues) {
      console.log(`   • ${item.title}`);
      for (const issue of item.issues) {
        console.log(`     - ${issue}`);
      }
    }
    console.log('');
  }

  if (!autoFix && invalid > 0) {
    console.log('💡 Run with --fix flag to auto-generate missing content');
    console.log('');
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n🔍 Product Verification Tool\n');
  console.log('═'.repeat(60));

  const args = process.argv.slice(2);
  const autoFix = args.includes('--fix');
  const useShopify = args.includes('--shopify');
  const source = useShopify ? 'shopify' : 'firestore';

  console.log(`   Source: ${source}`);
  console.log(`   Auto-Fix: ${autoFix ? 'Yes' : 'No'}`);

  // Check for API key if auto-fix is enabled
  if (autoFix && !process.env.GEMINI_API_KEY) {
    console.error('\n❌ GEMINI_API_KEY required for auto-fix');
    process.exit(1);
  }

  let products: ProductData[] = [];

  if (useShopify) {
    if (!SHOPIFY_STORE_URL || !SHOPIFY_ADMIN_API_TOKEN) {
      console.error('\n❌ Shopify credentials not configured');
      process.exit(1);
    }
    console.log(`   Store: ${SHOPIFY_STORE_URL}`);
    products = await fetchShopifyProducts();
  } else {
    if (!initFirebase()) {
      process.exit(1);
    }
    products = await fetchFirestoreProducts();
  }

  if (products.length === 0) {
    console.log('\n⚠️ No products found');
    process.exit(0);
  }

  await verifyAllProducts(products, autoFix, source);
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});


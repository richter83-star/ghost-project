#!/usr/bin/env node
/**
 * Product Verification Tool
 * Scans products and generates real content for them.
 * 
 * Usage:
 *   node verify-products.mjs              # Scan and report
 *   node verify-products.mjs --fix        # Scan and auto-fix
 */

import 'dotenv/config';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL || '';
const SHOPIFY_ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN || '';
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
const BASE_URL = `https://${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}`;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent`;

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_TOKEN,
  };
}

// ============================================================================
// FETCH PRODUCTS
// ============================================================================

async function fetchProducts() {
  const products = [];
  let url = `${BASE_URL}/products.json?limit=50&status=active`;

  while (url) {
    const response = await fetch(url, { headers: getHeaders() });
    const data = await response.json();
    
    for (const p of data.products) {
      products.push({
        id: String(p.id),
        title: p.title,
        description: (p.body_html || '').replace(/<[^>]*>/g, ''),
        productType: p.product_type,
        price: parseFloat(p.variants?.[0]?.price || '0'),
        images: p.images || [],
        tags: p.tags || '',
      });
    }

    const linkHeader = response.headers.get('link') || '';
    const nextMatch = linkHeader.match(/page_info=([^>]+)>; rel="next"/);
    url = nextMatch ? `${BASE_URL}/products.json?limit=50&page_info=${nextMatch[1]}` : null;
  }

  return products;
}

// ============================================================================
// CONTENT GENERATION
// ============================================================================

async function generateWithGemini(systemPrompt, userPrompt) {
  try {
    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('   Gemini API error:', data.error?.message || JSON.stringify(data).slice(0, 200));
      throw new Error(data.error?.message || 'Gemini API error');
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) {
      throw new Error('Empty response from Gemini');
    }
    return text;
  } catch (error) {
    console.error('   Gemini request failed:', error.message);
    throw error;
  }
}

async function generatePromptPack(title, theme) {
  console.log(`  🎨 Generating prompt pack...`);

  const systemPrompt = `You are an expert AI prompt engineer creating premium prompts for Midjourney, DALL-E, and Stable Diffusion.
Create detailed, professional prompts that would sell for $19-49.
Output ONLY valid JSON, no markdown.`;

  const userPrompt = `Create a premium prompt pack titled "${title}" with theme "${theme}".
Generate 15 unique, high-quality AI image generation prompts.

Return ONLY this JSON (no markdown):
{
  "title": "${title}",
  "theme": "${theme}",
  "prompts": [
    { "id": 1, "prompt": "detailed prompt text", "style": "style type", "model": "Midjourney", "parameters": "--ar 16:9 --v 6" }
  ],
  "usageGuide": "detailed guide (200+ words)",
  "tips": ["tip1", "tip2", "tip3"],
  "totalPrompts": 15
}`;

  const response = await generateWithGemini(systemPrompt, userPrompt);
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse JSON');
  return JSON.parse(jsonMatch[0]);
}

async function generateAutomationKit(title, platform, integrations) {
  console.log(`  🔧 Generating automation kit...`);

  const systemPrompt = `You are an automation expert creating premium workflow templates.
Create practical, well-documented workflows that would sell for $29-79.
Output ONLY valid JSON, no markdown.`;

  const userPrompt = `Create automation kit "${title}" for ${platform} integrating: ${integrations.join(', ')}.

Return ONLY this JSON (no markdown):
{
  "title": "${title}",
  "description": "comprehensive description",
  "platform": "${platform}",
  "integrations": ${JSON.stringify(integrations)},
  "workflow": {
    "name": "workflow name",
    "description": "what it does",
    "triggers": ["trigger1"],
    "actions": ["action1", "action2"],
    "nodes": [{ "id": "1", "type": "trigger", "name": "Name", "description": "desc", "config": {} }]
  },
  "setupGuide": "detailed setup guide (300+ words)",
  "prerequisites": ["prereq1"],
  "estimatedSetupTime": "15-30 minutes"
}`;

  const response = await generateWithGemini(systemPrompt, userPrompt);
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse JSON');
  return JSON.parse(jsonMatch[0]);
}

// ============================================================================
// VERIFICATION
// ============================================================================

function getContentType(productType) {
  const normalized = (productType || '').toLowerCase();
  if (normalized.includes('prompt') || normalized.includes('pack')) return 'prompt_pack';
  if (normalized.includes('automation') || normalized.includes('kit') || normalized.includes('workflow')) return 'automation_kit';
  if (normalized.includes('bundle')) return 'bundle';
  return 'prompt_pack'; // default
}

function verifyProduct(product) {
  const issues = [];

  if (!product.title || product.title.length < 5) {
    issues.push('Missing/short title');
  }
  if (!product.description || product.description.length < 50) {
    issues.push('Missing/short description');
  }
  if (!product.price || product.price <= 0) {
    issues.push('Invalid price');
  }
  if (!product.images || product.images.length === 0) {
    issues.push('No images');
  }
  if (!product.tags?.includes('has-content')) {
    issues.push('No deliverable content');
  }

  return {
    isValid: issues.length === 0,
    issues,
    hasContent: product.tags?.includes('has-content'),
  };
}

// ============================================================================
// UPDATE SHOPIFY
// ============================================================================

async function updateProductMetafield(productId, content) {
  // Add metafield with content
  await fetch(`${BASE_URL}/products/${productId}/metafields.json`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      metafield: {
        namespace: 'product_content',
        key: 'deliverable',
        value: JSON.stringify(content),
        type: 'json',
      },
    }),
  });
}

async function updateProductTags(productId, currentTags, newTag) {
  const tags = currentTags ? `${currentTags}, ${newTag}` : newTag;
  await fetch(`${BASE_URL}/products/${productId}.json`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ product: { id: productId, tags } }),
  });
}

async function updateProductDescription(productId, description) {
  await fetch(`${BASE_URL}/products/${productId}.json`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ product: { id: productId, body_html: `<p>${description}</p>` } }),
  });
}

// ============================================================================
// MAIN
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('\n🔍 Product Verification Tool\n');
  console.log('═'.repeat(50));

  const args = process.argv.slice(2);
  const autoFix = args.includes('--fix');

  if (!SHOPIFY_STORE_URL || !SHOPIFY_ADMIN_API_TOKEN) {
    console.error('❌ Missing SHOPIFY_STORE_URL or SHOPIFY_ADMIN_API_TOKEN');
    process.exit(1);
  }

  if (autoFix && !GEMINI_API_KEY) {
    console.error('❌ Missing GEMINI_API_KEY (required for --fix)');
    process.exit(1);
  }

  console.log(`Store: ${SHOPIFY_STORE_URL}`);
  console.log(`Auto-Fix: ${autoFix ? 'Yes' : 'No'}\n`);

  // Fetch products
  console.log('📥 Fetching products...');
  const products = await fetchProducts();
  console.log(`   Found ${products.length} products\n`);

  if (products.length === 0) {
    console.log('⚠️ No products found');
    return;
  }

  console.log('─'.repeat(50));

  let valid = 0, invalid = 0, fixed = 0;
  const issues = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    console.log(`\n[${i + 1}/${products.length}] ${product.title}`);

    const result = verifyProduct(product);

    if (result.isValid) {
      valid++;
      console.log('   ✅ VALID');
      continue;
    }

    console.log(`   ❌ Issues: ${result.issues.join(', ')}`);

    if (!autoFix) {
      invalid++;
      issues.push({ title: product.title, issues: result.issues });
      continue;
    }

    // Try to fix
    if (!result.hasContent) {
      try {
        const contentType = getContentType(product.productType);
        let content;

        if (contentType === 'prompt_pack') {
          const theme = product.title.replace(/prompt|pack|kit/gi, '').trim() || 'Digital Design';
          content = await generatePromptPack(product.title, theme);
        } else if (contentType === 'automation_kit') {
          const integrations = ['Google Sheets', 'Gmail', 'Slack'];
          content = await generateAutomationKit(product.title, 'n8n', integrations);
        } else {
          content = await generatePromptPack(product.title, 'Professional Design');
        }

        // Save content to metafield
        await updateProductMetafield(product.id, content);
        
        // Update tags
        await updateProductTags(product.id, product.tags, 'has-content');

        // Update description if too short
        if (product.description.length < 100) {
          const newDesc = content.description || content.usageGuide?.slice(0, 300) || 
            `${product.title} - Premium ${contentType.replace('_', ' ')} with professional quality content.`;
          await updateProductDescription(product.id, newDesc);
        }

        fixed++;
        console.log(`   🔧 FIXED - Generated ${contentType} content`);
      } catch (error) {
        invalid++;
        console.log(`   ❌ Fix failed: ${error.message}`);
        issues.push({ title: product.title, issues: [...result.issues, `Fix failed: ${error.message}`] });
      }
    } else {
      invalid++;
      issues.push({ title: product.title, issues: result.issues });
    }

    // Rate limit
    if (i < products.length - 1) {
      await sleep(2000);
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(50));
  console.log(`   Total: ${products.length}`);
  console.log(`   ✅ Valid: ${valid}`);
  console.log(`   ❌ Invalid: ${invalid}`);
  if (autoFix) console.log(`   🔧 Fixed: ${fixed}`);
  console.log('');

  if (issues.length > 0) {
    console.log('❌ PRODUCTS WITH ISSUES:');
    for (const item of issues) {
      console.log(`   • ${item.title}: ${item.issues.join(', ')}`);
    }
  }

  if (!autoFix && invalid > 0) {
    console.log('\n💡 Run with --fix to auto-generate content');
  }

  console.log('');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});


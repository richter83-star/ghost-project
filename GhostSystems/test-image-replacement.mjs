#!/usr/bin/env node

/**
 * Test script to verify product image replacement
 * Tests the /api/design/generate-images endpoint
 */

function getRenderUrl() {
  if (process.env.RENDER_EXTERNAL_URL) {
    return process.env.RENDER_EXTERNAL_URL.replace(/^https?:\/\//, '');
  }
  if (process.env.RENDER_URL) {
    return process.env.RENDER_URL.replace(/^https?:\/\//, '');
  }
  // Fallback
  return 'ghostsystems.onrender.com';
}

const RENDER_URL = getRenderUrl();
const API_URL = `https://${RENDER_URL}`;

async function testImageReplacement() {
  console.log('\n🧪 Testing Product Image Replacement\n');
  console.log('='.repeat(50));
  console.log(`API URL: ${API_URL}`);
  console.log('='.repeat(50));
  
  const forceReplace = process.argv.includes('--force');
  const limit = process.argv.find(arg => arg.startsWith('--limit='))?.split('=')[1] || '5';
  
  const endpoint = `${API_URL}/api/design/generate-images?force=${forceReplace}&limit=${limit}`;
  
  console.log(`\n📡 Calling: POST ${endpoint}`);
  console.log(`   Force replace: ${forceReplace}`);
  console.log(`   Limit: ${limit} products\n`);
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error: ${response.status} ${response.statusText}`);
      console.error(`   Response: ${errorText}`);
      process.exit(1);
    }
    
    const result = await response.json();
    
    console.log('\n✅ Image Replacement Test Results:');
    console.log('='.repeat(50));
    console.log(`Success: ${result.success ? '✅' : '❌'}`);
    console.log(`Generated: ${result.generated || 0} images`);
    console.log(`Failed: ${result.failed || 0} images`);
    console.log(`Total processed: ${result.total || 0} products`);
    
    if (result.message) {
      console.log(`\nMessage: ${result.message}`);
    }
    
    if (result.results && result.results.length > 0) {
      console.log('\n📋 Product Results:');
      result.results.forEach((r, i) => {
        const status = r.status === 'success' ? '✅' : '❌';
        console.log(`   ${i + 1}. ${status} ${r.title}`);
        if (r.error) {
          console.log(`      Error: ${r.error}`);
        }
      });
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('\n💡 Next Steps:');
    console.log('   1. Wait 2-3 minutes for Shopify to process images');
    console.log('   2. Visit your store: https://dracanus-ai.myshopify.com');
    console.log('   3. Check product pages - DRACANUS images should be primary');
    console.log('   4. Images should appear by default (not just on hover)\n');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('   1. Check if Render service is deployed and running');
    console.error(`   2. Verify API URL is correct: ${API_URL}`);
    console.error('   3. Check Render logs for errors');
    console.error('   4. Ensure GEMINI_API_KEY is set in Render environment\n');
    process.exit(1);
  }
}

// Run test
testImageReplacement().catch(console.error);


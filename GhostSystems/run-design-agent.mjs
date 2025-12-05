#!/usr/bin/env node
/**
 * Run Store Design Agent
 * Triggers the AI design agent to analyze store and generate recommendations.
 * 
 * Run: node run-design-agent.mjs
 */

import 'dotenv/config';

// Try to detect Render URL from environment
function getRenderUrl() {
  // Check if we're on Render
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
const CRON_SECRET = process.env.CRON_SECRET || '';

async function main() {
  console.log('\n🎨 Store Design Agent Runner\n');
  console.log('='.repeat(50));

  const url = `https://${RENDER_URL}/api/design/run`;
  
  console.log(`Triggering: ${url}\n`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(CRON_SECRET ? { 'Authorization': `Bearer ${CRON_SECRET}` } : {}),
      },
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Design Agent Run Complete!');
      console.log(`   Recommendations: ${data.recommendations || 0}`);
      console.log(`   Success: ${data.success ? 'Yes' : 'No'}`);
      if (data.error) {
        console.log(`   Error: ${data.error}`);
      }
      console.log('\n💡 Check your email for recommendations or visit:');
      console.log(`   https://${RENDER_URL}/api/design/recommendations\n`);
    } else {
      console.error('❌ Failed:', data.error || 'Unknown error');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    console.log('\n💡 Alternative: Call the API directly with curl:');
    console.log(`   curl -X POST http://localhost:${process.env.PORT || 10000}/api/design/run`);
    console.log('\nOr make sure:');
    console.log('   1. Your Render service is running');
    console.log('   2. ENABLE_STORE_DESIGN_AGENT=true in environment');
    console.log('   3. GEMINI_API_KEY is set');
    process.exit(1);
  }
}

main();


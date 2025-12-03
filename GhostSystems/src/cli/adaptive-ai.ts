/**
 * Adaptive AI CLI
 * 
 * Command-line interface for running adaptive AI product generation
 * and market analysis.
 */

import 'dotenv/config';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { generateMarketInsights } from '../lib/adaptive-ai/analytics.js';
import { generateAndSaveProducts } from '../lib/adaptive-ai/generator.js';

async function initFirebase() {
  if (getApps().length > 0) {
    return;
  }

  let serviceAccount: any;

  // Method 1: Check for JSON string in env var
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
      console.log('✅ Loaded Firebase credentials from FIREBASE_SERVICE_ACCOUNT_JSON\n');
    } catch (error) {
      console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', (error as Error).message);
      process.exit(1);
    }
  }
  // Method 2: Check for file path
  else {
    const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    if (filePath) {
      const resolvedPath = filePath.startsWith('/') || filePath.startsWith('C:')
        ? filePath
        : join(process.cwd(), filePath);

      if (existsSync(resolvedPath)) {
        try {
          const fileContent = readFileSync(resolvedPath, 'utf8');
          serviceAccount = JSON.parse(fileContent);
          console.log(`✅ Loaded Firebase credentials from file: ${resolvedPath}\n`);
        } catch (error) {
          console.error(`❌ Failed to read/parse Firebase file at ${resolvedPath}:`, (error as Error).message);
          process.exit(1);
        }
      } else {
        console.error(`❌ Firebase service account file not found at: ${resolvedPath}`);
        process.exit(1);
      }
    } else {
      console.error('❌ Firebase credentials not found.');
      console.error('   Please set either:');
      console.error('   - FIREBASE_SERVICE_ACCOUNT_JSON (JSON string)');
      console.error('   - FIREBASE_SERVICE_ACCOUNT_PATH (path to JSON file)');
      console.error('\n   Or create a .env file in GhostSystems/ with one of these variables.');
      process.exit(1);
    }
  }

  try {
    initializeApp({
      credential: cert(serviceAccount as any),
    });
    console.log('✅ Firebase Admin initialized\n');
  } catch (error: any) {
    console.error('❌ Failed to initialize Firebase:', error.message);
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'generate';

  await initFirebase();

  const collectionName = process.env.FIRESTORE_JOBS_COLLECTION || 'products';

  if (command === 'analyze' || command === 'insights') {
    console.log('📊 Generating market insights...\n');
    const insights = await generateMarketInsights(collectionName);
    
    console.log('\n=== MARKET INSIGHTS ===\n');
    console.log(`Top Performing Products (${insights.topPerformingProducts.length}):`);
    insights.topPerformingProducts.slice(0, 5).forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.title}`);
      console.log(`     Type: ${p.productType}, Sales: ${p.totalSales}, Revenue: $${p.totalRevenue.toFixed(2)}, Trend: ${p.trend} (${p.growthRate.toFixed(1)}%)`);
    });

    console.log(`\nTop Performing Niches (${insights.topPerformingNiches.length}):`);
    insights.topPerformingNiches.slice(0, 5).forEach((n, i) => {
      console.log(`  ${i + 1}. ${n.niche}`);
      console.log(`     Products: ${n.totalProducts}, Revenue: $${n.totalRevenue.toFixed(2)}, Growth: ${n.growthRate.toFixed(1)}%`);
    });

    console.log(`\nTrending Product Types:`);
    insights.trendingProductTypes.slice(0, 5).forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.type} - Growth: ${t.growthRate.toFixed(1)}%, Avg Revenue: $${t.avgRevenue.toFixed(2)}`);
    });

    console.log(`\nOptimal Price Ranges:`);
    Object.entries(insights.optimalPriceRanges).forEach(([type, range]) => {
      console.log(`  ${type}: $${range.min}-$${range.max} (avg revenue: $${range.avgRevenue.toFixed(2)})`);
    });

    console.log(`\nRecommendations:`);
    console.log(`  Generate More: ${insights.recommendations.generateMore.length}`);
    insights.recommendations.generateMore.slice(0, 3).forEach(rec => {
      console.log(`    - ${rec.type} for ${rec.niche}: ${rec.reason}`);
    });
    console.log(`  Adjust Pricing: ${insights.recommendations.adjustPricing.length}`);
    insights.recommendations.adjustPricing.slice(0, 3).forEach(rec => {
      console.log(`    - ${rec.productId}: $${rec.currentPrice} → $${rec.recommendedPrice} (${rec.reason})`);
    });
    console.log(`  Discontinue: ${insights.recommendations.discontinue.length}`);
    insights.recommendations.discontinue.slice(0, 3).forEach(rec => {
      console.log(`    - ${rec.productId}: ${rec.reason}`);
    });

  } else if (command === 'generate' || command === 'gen') {
    const count = parseInt(args[1] || '3', 10);
    console.log(`🧠 Generating ${count} products using adaptive AI...\n`);
    
    const createdIds = await generateAndSaveProducts(count, collectionName);
    
    if (createdIds.length > 0) {
      console.log(`\n✅ Successfully generated ${createdIds.length} products`);
      console.log(`   Product IDs: ${createdIds.join(', ')}`);
    } else {
      console.log('\n⚠️ No products generated. This may be due to:');
      console.log('   - Insufficient market data (need at least some sales)');
      console.log('   - No viable strategies found');
      console.log('   - Try running "analyze" first to see market insights');
    }
  } else {
    console.log('Usage:');
    console.log('  npm run adaptive-ai:analyze  - Show market insights');
    console.log('  npm run adaptive-ai:generate [count]  - Generate products (default: 3)');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});


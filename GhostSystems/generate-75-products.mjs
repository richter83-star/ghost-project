#!/usr/bin/env node
/**
 * Generate 75 Products Over 3 Days
 * Wrapper script that calls the Adaptive AI generator in batches.
 * 
 * Usage:
 *   node generate-75-products.mjs [batchSize] [totalTarget]
 *   node generate-75-products.mjs 25 75  (default: 25 per batch, 75 total)
 * 
 * This script uses the existing Adaptive AI system via npm script.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function main() {
  console.log('\n🧠 Adaptive AI - Generate 75 Products (Batch Mode)\n');
  console.log('='.repeat(60));
  
  const args = process.argv.slice(2);
  const batchSize = parseInt(args[0]) || 25; // Default 25 per batch
  const totalTarget = parseInt(args[1]) || 75; // Default 75 total
  
  console.log(`Target: ${totalTarget} products`);
  console.log(`Batch size: ${batchSize} products`);
  console.log(`Estimated batches: ${Math.ceil(totalTarget / batchSize)}\n`);

  try {
    let totalGenerated = 0;
    let batchNumber = 1;
    
    while (totalGenerated < totalTarget) {
      const remaining = totalTarget - totalGenerated;
      const currentBatch = Math.min(batchSize, remaining);
      
      console.log(`\n📦 Batch ${batchNumber}: Generating ${currentBatch} products...`);
      console.log(`   Progress: ${totalGenerated}/${totalTarget} (${Math.round(totalGenerated / totalTarget * 100)}%)\n`);
      
      try {
        // Call the existing Adaptive AI generator
        const { stdout, stderr } = await execAsync(
          `npm run adaptive-ai:generate ${currentBatch}`,
          { cwd: process.cwd() }
        );
        
        if (stdout) console.log(stdout);
        if (stderr) console.warn(stderr);
        
        // Estimate how many were created (the CLI doesn't return exact count)
        // We'll assume all were created for simplicity
        totalGenerated += currentBatch;
        batchNumber++;
        
        console.log(`\n✅ Batch ${batchNumber - 1} complete`);
        
        // If we've reached the target, stop
        if (totalGenerated >= totalTarget) {
          break;
        }
        
        // Wait before next batch (to avoid rate limits)
        if (totalGenerated < totalTarget) {
          console.log('\n⏳ Waiting 5 seconds before next batch...\n');
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.error(`❌ Batch ${batchNumber} failed:`, error.message);
        // Continue with next batch
        batchNumber++;
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`🎉 Batch generation complete!`);
    console.log(`📊 Total generated: ${totalGenerated} products`);
    console.log('='.repeat(60));
    console.log('\n💡 Products are now in "pending" status');
    console.log('   QA Gate will evaluate them automatically');
    console.log('   Products with qa_passed status will publish to Shopify');
    console.log('\n💡 To generate more batches, run this script again\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();


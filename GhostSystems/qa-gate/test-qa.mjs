#!/usr/bin/env node

/**
 * Test script to verify QA Gate is working
 * Can be run locally or on Render
 */

import 'dotenv/config';

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const FIRESTORE_JOBS_COLLECTION = process.env.FIRESTORE_JOBS_COLLECTION || 'products';

console.log('\n🧪 QA Gate Configuration Test\n');
console.log('='.repeat(50));

// Check required variables
let hasErrors = false;

if (!FIREBASE_PROJECT_ID) {
  console.error('❌ FIREBASE_PROJECT_ID is not set');
  hasErrors = true;
} else {
  console.log(`✅ FIREBASE_PROJECT_ID: ${FIREBASE_PROJECT_ID}`);
}

if (!FIREBASE_SERVICE_ACCOUNT_JSON) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT_JSON is not set');
  hasErrors = true;
} else {
  try {
    const parsed = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
    console.log(`✅ FIREBASE_SERVICE_ACCOUNT_JSON: Valid JSON`);
    console.log(`   Project ID in JSON: ${parsed.project_id}`);
    console.log(`   Client Email: ${parsed.client_email}`);
    
    if (parsed.project_id !== FIREBASE_PROJECT_ID) {
      console.warn(`⚠️  Warning: Project ID mismatch!`);
      console.warn(`   FIREBASE_PROJECT_ID: ${FIREBASE_PROJECT_ID}`);
      console.warn(`   JSON project_id: ${parsed.project_id}`);
    }
  } catch (e) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON');
    console.error(`   Error: ${e.message}`);
    hasErrors = true;
  }
}

console.log(`\n📋 Optional Configuration:`);
console.log(`   FIRESTORE_JOBS_COLLECTION: ${FIRESTORE_JOBS_COLLECTION}`);
console.log(`   QA_SCAN_STATUSES: ${process.env.QA_SCAN_STATUSES || 'pending,draft (default)'}`);
console.log(`   QA_WRITE_STATUS: ${process.env.QA_WRITE_STATUS || 'true (default)'}`);
console.log(`   QA_PASSED_STATUS: ${process.env.QA_PASSED_STATUS || 'qa_passed (default)'}`);
console.log(`   QA_FAILED_STATUS: ${process.env.QA_FAILED_STATUS || 'qa_failed (default)'}`);
console.log(`   QA_BATCH_LIMIT: ${process.env.QA_BATCH_LIMIT || '25 (default)'}`);
console.log(`   QA_SCAN_CRON: ${process.env.QA_SCAN_CRON || '*/15 * * * * (default)'}`);

console.log('\n' + '='.repeat(50));

if (hasErrors) {
  console.error('\n❌ Configuration has errors. Please fix them before deploying.');
  process.exit(1);
} else {
  console.log('\n✅ Configuration looks good!');
  console.log('\n💡 Next steps:');
  console.log('   1. Deploy to Render (or run locally with npm run qa:dev)');
  console.log('   2. Check Render logs for "QA Gate starting"');
  console.log('   3. Wait for first sweep to complete');
  console.log('   4. Check Firestore for products with qa field');
  console.log('   5. Verify products are getting qa_passed/qa_failed status\n');
  process.exit(0);
}


#!/usr/bin/env node
/**
 * Firestore Cleanup Script
 * Removes placeholder/POD products that don't belong in digital products collection.
 * 
 * Run: node cleanup-firestore.mjs
 */

import 'dotenv/config';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Products types to REMOVE (POD / placeholders)
const REMOVE_TYPES = [
  't-shirt',
  'tshirt',
  't shirt',
  'shirt',
  'mug',
  'hoodie',
  'poster',
  'sticker',
  'hat',
  'cap',
  'phone case',
  'pillow',
  'blanket',
  'tote bag',
  'tech gadget',
];

// Statuses to remove (failed/stuck products)
const REMOVE_STATUSES = [
  'failed',
  'pending', // old stuck pending jobs
];

let db = null;

function initFirebase() {
  if (db) return true;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    console.error('❌ FIREBASE_SERVICE_ACCOUNT_JSON not set');
    return false;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    if (!getApps().length) {
      initializeApp({ credential: cert(serviceAccount) });
    }
    db = getFirestore();
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error.message);
    return false;
  }
}

function shouldRemove(doc) {
  const data = doc.data();
  const productType = (data.productType || data.product_type || '').toLowerCase();
  const title = (data.title || '').toLowerCase();
  const status = (data.status || '').toLowerCase();

  // Remove by product type
  for (const type of REMOVE_TYPES) {
    if (productType.includes(type) || title.includes(type)) {
      return { remove: true, reason: `POD product type: ${type}` };
    }
  }

  // Remove failed/stuck products
  if (REMOVE_STATUSES.includes(status)) {
    return { remove: true, reason: `Status: ${status}` };
  }

  return { remove: false };
}

async function main() {
  console.log('\n🧹 Firestore Cleanup Tool\n');
  console.log('═'.repeat(50));

  if (!initFirebase()) {
    process.exit(1);
  }

  const collection = process.env.FIRESTORE_JOBS_COLLECTION || 'products';
  console.log(`Collection: ${collection}\n`);

  // Fetch all documents
  console.log('📥 Fetching documents...');
  const snapshot = await db.collection(collection).get();
  console.log(`   Found ${snapshot.docs.length} documents\n`);

  if (snapshot.docs.length === 0) {
    console.log('⚠️ No documents found');
    return;
  }

  // Analyze documents
  const toRemove = [];
  const toKeep = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const { remove, reason } = shouldRemove(doc);

    if (remove) {
      toRemove.push({ id: doc.id, title: data.title, reason });
    } else {
      toKeep.push({ id: doc.id, title: data.title, status: data.status });
    }
  }

  console.log('─'.repeat(50));
  console.log(`\n📊 Analysis:`);
  console.log(`   Keep: ${toKeep.length}`);
  console.log(`   Remove: ${toRemove.length}\n`);

  if (toRemove.length === 0) {
    console.log('✅ Nothing to remove!');
    return;
  }

  // Show what will be removed
  console.log('🗑️  TO BE REMOVED:');
  console.log('─'.repeat(50));
  for (const item of toRemove) {
    console.log(`   • ${item.title || item.id}`);
    console.log(`     Reason: ${item.reason}`);
  }

  // Delete documents
  console.log('\n🗑️  Deleting...');
  let deleted = 0;

  for (const item of toRemove) {
    try {
      await db.collection(collection).doc(item.id).delete();
      deleted++;
      console.log(`   ✅ Deleted: ${item.title || item.id}`);
    } catch (error) {
      console.log(`   ❌ Failed to delete ${item.id}: ${error.message}`);
    }
  }

  console.log('\n' + '═'.repeat(50));
  console.log('📊 CLEANUP COMPLETE');
  console.log('═'.repeat(50));
  console.log(`   Deleted: ${deleted}`);
  console.log(`   Remaining: ${toKeep.length}`);
  console.log('');

  // Show remaining products
  if (toKeep.length > 0 && toKeep.length <= 20) {
    console.log('📦 REMAINING PRODUCTS:');
    for (const item of toKeep) {
      console.log(`   • ${item.title} (${item.status})`);
    }
    console.log('');
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});


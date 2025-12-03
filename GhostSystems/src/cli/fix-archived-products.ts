// Fix incorrectly archived products that were marked as "not_digital_only"
// but are actually digital products
import 'dotenv/config';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ALLOWED_TYPES = new Set(['prompt_pack', 'automation_kit', 'bundle']);

function isDigitalOnly(data: any): boolean {
  // Check all possible field name variations
  if (
    data?.digitalOnly === true ||
    data?.digital_only === true ||
    data?.is_digital === true ||
    data?.digital === true
  ) {
    return true;
  }
  
  // All products in ALLOWED_TYPES are digital by nature
  const type = data?.productType || data?.product_type;
  if (type && ALLOWED_TYPES.has(type)) {
    return true;
  }
  
  // Also check if requires_shipping is false (indicates digital)
  if (data?.requires_shipping === false || data?.requiresShipping === false) {
    return true;
  }
  
  return false;
}

async function main() {
  console.log('=================================');
  console.log('  FIX ARCHIVED PRODUCTS SCRIPT  ');
  console.log('=================================\n');

  // Initialize Firebase - support both JSON string and file path
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
    if (!getApps().length) {
      initializeApp({
        credential: cert(serviceAccount as any),
      });
    }

    const db = getFirestore();
    const collectionName = process.env.FIRESTORE_JOBS_COLLECTION || 'products';

    console.log(`📡 Connecting to Firestore collection: "${collectionName}"\n`);

    // Find all products with skipReason: "not_digital_only"
    const snapshot = await db
      .collection(collectionName)
      .where('skipReason', '==', 'not_digital_only')
      .get();

    if (snapshot.empty) {
      console.log('✅ No products found with skipReason: "not_digital_only"');
      process.exit(0);
    }

    console.log(`Found ${snapshot.size} products with skipReason: "not_digital_only"\n`);

    let fixed = 0;
    let skipped = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const id = doc.id;
      const title = data?.title || 'Untitled';

      // Check if this product is actually digital
      if (isDigitalOnly(data)) {
        console.log(`✅ Fixing: "${title}" (${id})`);
        
        // Restore to draft status so it can be processed
        await doc.ref.update({
          status: 'draft',
          skipReason: FieldValue.delete(),
          fixedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        
        fixed++;
      } else {
        console.log(`⏭️  Skipping (actually not digital): "${title}" (${id})`);
        skipped++;
      }
    }

    console.log(`\n=================================`);
    console.log(`✅ Fixed: ${fixed} products`);
    console.log(`⏭️  Skipped: ${skipped} products`);
    console.log(`=================================\n`);

    if (fixed > 0) {
      console.log(`🎉 ${fixed} products have been restored to "draft" status and will be processed.`);
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();


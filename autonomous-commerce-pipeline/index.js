// autonomous-commerce-pipeline/index.js
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

// --- Path helpers for ES modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===============================
// Hard rules (curation gate)
// ===============================
const ALLOWED_TYPES = new Set(['prompt_pack', 'automation_kit', 'bundle']);

// Treat these as "digital only" booleans across legacy/new docs
// Check multiple field name variations used by Oracle/brain.py
function isDigitalOnly(data) {
  // Check all possible field name variations
  if (
    data?.digitalOnly === true ||
    data?.digital_only === true ||
    data?.is_digital === true ||
    data?.digital === true
  ) {
    return true;
  }
  
  // All products in ALLOWED_TYPES are digital by nature (prompt_pack, automation_kit, bundle)
  // If product type is in allowed types, treat as digital
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

function shouldProcess(data) {
  const type = data?.productType || data?.product_type;
  if (!ALLOWED_TYPES.has(type)) return { ok: false, reason: `blocked_type:${type || 'missing'}` };
  if (!isDigitalOnly(data)) return { ok: false, reason: `not_digital_only` };
  return { ok: true };
}

// --- Firebase bootstrap using service account JSON file ---
function initFirebase() {
  // Note: firebase-admin uses admin.apps (array)
  if (admin.apps && admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!serviceAccountPath) {
    throw new Error(
      'Missing FIREBASE_SERVICE_ACCOUNT_PATH. In Render, point it to your Secret File path, e.g. /etc/secrets/KEY_HOME'
    );
  }

  const resolvedPath = path.isAbsolute(serviceAccountPath)
    ? serviceAccountPath
    : path.join(__dirname, serviceAccountPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Service account file not found at: ${resolvedPath}`);
  }

  const serviceAccountJson = fs.readFileSync(resolvedPath, 'utf8');
  const serviceAccount = JSON.parse(serviceAccountJson);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  console.log('[Pipeline] ✅ Firebase Admin initialized.');
  return admin.app();
}

async function processDraftProducts() {
  const app = initFirebase();
  const db = app.firestore();

  // Prefer the correct name, but keep backwards compatibility
  const collectionName =
    process.env.FIRESTORE_PRODUCTS_COLLECTION ||
    process.env.FIRESTORE_JOBS_COLLECTION ||
    'products';

  // NOTE: your system uses lowercase statuses: pending -> draft -> ready_for_shopify
  const snapshot = await db
    .collection(collectionName)
    .where('status', '==', 'draft')
    .get();

  if (snapshot.empty) {
    console.log('[Pipeline] No DRAFT products found. Exiting.');
    return;
  }

  console.log(`[Pipeline] Found ${snapshot.size} DRAFT products to process.`);

  let moved = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const id = doc.id;

    // ✅ CURATION GATE: only digital AI goods, only allowed types
    const verdict = shouldProcess(data);
    if (!verdict.ok) {
      skipped++;
      console.log(
        `[Pipeline] ⏭️ Skipping ${id} "${data?.title || 'Untitled'}" (${verdict.reason})`
      );

      // Optional: quarantine junk so it stops clogging the pipe
      await doc.ref.update({
        status: 'archived_junk',
        skipReason: verdict.reason,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      continue;
    }

    const productType = data.productType || data.product_type;
    console.log(
      `[Pipeline] (a) Processing DRAFT ${productType} ${id} - "${data.title}"`
    );

    // Bundle-aware flags for the next stage (Shopify publish)
    const isBundle = productType === 'bundle';

    // TODO: hook in Gemini / image gen / Shopify here.
    // For now move forward safely.
    await doc.ref.update({
      status: 'ready_for_shopify',
      requiresBundleAssembly: isBundle, // Shopify stage can use this
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    moved++;
    console.log(
      `[Pipeline] (b) Moved ${id} -> status="ready_for_shopify"${isBundle ? ' (bundle)' : ''}.`
    );
  }

  console.log(`[Pipeline] ✅ Done. moved=${moved} skipped=${skipped}`);
}

(async () => {
  try {
    console.log('==============================');
    console.log('   AUTONOMOUS COMMERCE JOB    ');
    console.log('==============================');

    await processDraftProducts();

    console.log('[Pipeline] Job complete. Exiting.');
    process.exit(0);
  } catch (err) {
    console.error('[Pipeline] ❌ Fatal error:', err);
    process.exit(1);
  }
})();

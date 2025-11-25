// autonomous-commerce-pipeline/index.js
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

// --- Path helpers for ES modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Firebase bootstrap using service account JSON ---
function initFirebase() {
  if (admin.apps && admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './your-service-account-key.json';

  const resolvedPath = path.isAbsolute(serviceAccountPath)
    ? serviceAccountPath
    : path.join(__dirname, serviceAccountPath);

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

  const collectionName =
    process.env.FIRESTORE_JOBS_COLLECTION || 'products'; // your env already set to "products"

  const snapshot = await db
    .collection(collectionName)
    .where('status', '==', 'draft')
    .get();

  if (snapshot.empty) {
    console.log('[Pipeline] No DRAFT products found. Exiting.');
    return;
  }

  console.log(`[Pipeline] Found ${snapshot.size} DRAFT products to process.`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const id = doc.id;

    console.log(`[Pipeline] (a) Processing DRAFT product ${id} - "${data.title}"`);

    // TODO: hook in Gemini / Imagen / Shopify here.
    // For now we just move it along the pipeline safely.
    await doc.ref.update({
      status: 'ready_for_shopify',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(
      `[Pipeline] (b) Moved product ${id} -> status = "ready_for_shopify".`
    );
  }
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

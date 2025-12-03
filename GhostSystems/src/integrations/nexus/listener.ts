import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

let db: FirebaseFirestore.Firestore | null = null;

/**
 * Initialize Firebase Admin using FIREBASE_SERVICE_ACCOUNT_JSON env var.
 */
function initAdmin() {
  if (db) return; // already initialized

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson) {
    console.error(
      '[GhostSystems] ❌ FIREBASE_SERVICE_ACCOUNT_JSON missing. Nexus listener will NOT run.'
    );
    return;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);

    if (!getApps().length) {
      initializeApp({
        credential: cert(serviceAccount as any),
      });
    }

    db = getFirestore();
    console.log('[GhostSystems] ✅ Firebase Admin initialized for Nexus.');
  } catch (err) {
    console.error(
      '[GhostSystems] ❌ Failed to initialize Firebase Admin from FIREBASE_SERVICE_ACCOUNT_JSON:',
      err
    );
  }
}

/**
 * Listen for products with status === "pending" and move them to "draft".
 */
export function startNexusListener() {
  initAdmin();

  if (!db) {
    console.error(
      '[GhostSystems] ❌ Firestore not initialized. Aborting Nexus listener.'
    );
    return;
  }

  const collectionName = process.env.FIRESTORE_JOBS_COLLECTION || 'products';

  console.log(
    `[GhostSystems] 📡 Nexus Listener: Watching products with status = "pending" in collection "${collectionName}"...`
  );

  const productsRef = db.collection(collectionName);
  const query = productsRef.where('status', '==', 'pending');

  query.onSnapshot(
    (snapshot) => {
      let pendingCount = 0;

      snapshot.docChanges().forEach(async (change) => {
        if (change.type !== 'added') return;

        pendingCount++;

        const docSnap = change.doc;
        const data = docSnap.data();
        const productId = docSnap.id;
        const title = (data as any)?.title || '(no title)';

        console.log(
          `[GhostSystems] (a) Found PENDING product: ${productId} - "${title}"`
        );

        try {
          await productsRef.doc(productId).update({
            status: 'draft',
            movedToDraftAt: FieldValue.serverTimestamp(),
          });

          console.log(
            `[GhostSystems] (b) Moved product ${productId} to DRAFT.`
          );
        } catch (err) {
          console.error(
            `[GhostSystems] ❌ Error moving ${productId} to DRAFT:`,
            err
          );
        }
      });

      if (pendingCount > 0) {
        console.log(
          `[GhostSystems] ✅ Processed ${pendingCount} pending products in this batch.`
        );
      }
    },
    (error) => {
      console.error('[GhostSystems] ❌ Listener Error:', error);
    }
  );
}

import * as admin from 'firebase-admin';

// ------------------------------
// 1. Initialize Admin SDK
// ------------------------------
if (!admin.apps.length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson) {
    console.error(
      '[GhostSystems] ❌ FIREBASE_SERVICE_ACCOUNT_JSON missing. Nexus listener will NOT run.'
    );
  } else {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('[GhostSystems] ✅ Firebase Admin initialized for Nexus.');
    } catch (err) {
      console.error(
        '[GhostSystems] ❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:',
        err
      );
    }
  }
}

const db = admin.firestore();

// ------------------------------
// 2. PENDING -> DRAFT listener
// ------------------------------
export function startNexusListener() {
  if (!admin.apps.length) {
    console.error(
      '[GhostSystems] ❌ Firebase Admin not initialized. startNexusListener() aborted.'
    );
    return;
  }

  console.log(
    '[GhostSystems] 📡 Nexus Listener: Watching products with status = "pending"...'
  );

  const productsRef = db.collection('products');
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
        const title = data?.title || '(no title)';

        console.log(
          `[GhostSystems] (a) Found PENDING product: ${productId} - "${title}"`
        );

        try {
          await productsRef.doc(productId).update({
            status: 'draft',
            movedToDraftAt: admin.firestore.FieldValue.serverTimestamp(),
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

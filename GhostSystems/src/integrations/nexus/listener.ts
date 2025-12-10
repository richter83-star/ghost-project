import { db, FieldValue } from '../../firebase.js';
import config from '../../config.js';

/**
 * Listen for products with status === "pending" and move them to "draft".
 */
export function startNexusListener() {
  if (!db) {
    console.error('[GhostSystems][NexusListener] Firestore not initialized. Aborting listener.');
    return;
  }

  const collectionName = config.firebase.jobsCollection;
  console.log(
    `[GhostSystems][NexusListener] 📡 Watching products with status = "pending" in collection "${collectionName}"...`
  );

  const productsRef = db.collection(collectionName);
  const query = productsRef.where('status', '==', 'pending');

  query.onSnapshot(
    (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        if (change.type !== 'added') return;

        const docSnap = change.doc;
        const data = docSnap.data();
        const productId = docSnap.id;
        const title = (data as any)?.title || '(no title)';

        console.log(
          `[GhostSystems][NexusListener] Detected PENDING product: ${productId} - "${title}"`
        );

        try {
          await productsRef.doc(productId).update({
            status: 'draft',
            movedToDraftAt: FieldValue.serverTimestamp(),
          });

          console.log(
            `[GhostSystems][NexusListener] Moved product ${productId} to DRAFT.`
          );
        } catch (err: any) {
          const message = (err?.message || String(err)).slice(0, 500);
          console.error(
            `[GhostSystems][NexusListener] Error moving ${productId} to DRAFT: ${message}`
          );

          try {
            await productsRef.doc(productId).update({
              errorStage: 'nexus_listener',
              lastErrorAt: FieldValue.serverTimestamp(),
              lastErrorMessage: message,
            });
          } catch (writeErr: any) {
            console.error(
              `[GhostSystems][NexusListener] Failed to write error state for ${productId}: ${writeErr?.message || writeErr}`
            );
          }
        }
      });
    },
    (error) => {
      console.error('[GhostSystems][NexusListener] Listener Error:', error);
    }
  );
}

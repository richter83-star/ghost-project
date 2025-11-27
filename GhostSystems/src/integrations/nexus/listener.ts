// GhostSystems/src/integrations/nexus/listener.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

let db: FirebaseFirestore.Firestore | null = null;

// --- Path helpers for ES modules ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initialize Firebase Admin using either:
 * 1) FIREBASE_SERVICE_ACCOUNT_PATH (preferred; Render secret file path)
 * 2) FIREBASE_SERVICE_ACCOUNT_JSON (fallback; inline JSON)
 */
function initAdmin() {
  if (db) return;

  const serviceAccountPath = (process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "").trim();
  const serviceAccountJson = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();

  let serviceAccountObj: any | null = null;

  try {
    if (serviceAccountPath) {
      const resolvedPath = path.isAbsolute(serviceAccountPath)
        ? serviceAccountPath
        : path.join(__dirname, serviceAccountPath);

      if (!fs.existsSync(resolvedPath)) {
        throw new Error(
          `Service account file not found at: ${resolvedPath} (from FIREBASE_SERVICE_ACCOUNT_PATH)`
        );
      }

      const raw = fs.readFileSync(resolvedPath, "utf8");
      serviceAccountObj = JSON.parse(raw);
    } else if (serviceAccountJson) {
      serviceAccountObj = JSON.parse(serviceAccountJson);
    } else {
      console.error(
        "[GhostSystems] ❌ Missing credentials. Set FIREBASE_SERVICE_ACCOUNT_PATH (preferred) or FIREBASE_SERVICE_ACCOUNT_JSON."
      );
      return;
    }

    if (!getApps().length) {
      initializeApp({
        credential: cert(serviceAccountObj),
      });
    }

    db = getFirestore();
    console.log("[GhostSystems] ✅ Firebase Admin initialized for Nexus.");
  } catch (err) {
    console.error("[GhostSystems] ❌ Failed to initialize Firebase Admin:", err);
  }
}

/**
 * Listen for products with status === "pending" and move them to "draft".
 */
export function startNexusListener() {
  initAdmin();

  if (!db) {
    console.error("[GhostSystems] ❌ Firestore not initialized. Aborting Nexus listener.");
    return;
  }

  const collectionName = process.env.FIRESTORE_JOBS_COLLECTION || "products";

  console.log(
    `[GhostSystems] 📡 Nexus Listener: Watching ${collectionName} where status = "pending"...`
  );

  const productsRef = db.collection(collectionName);
  const query = productsRef.where("status", "==", "pending");

  query.onSnapshot(
    (snapshot) => {
      let pendingCount = 0;

      snapshot.docChanges().forEach((change) => {
        if (change.type !== "added") return;

        pendingCount++;

        const docSnap = change.doc;
        const data = docSnap.data();
        const productId = docSnap.id;
        const title = (data as any)?.title || "(no title)";

        console.log(`[GhostSystems] (a) Found PENDING product: ${productId} - "${title}"`);

        productsRef
          .doc(productId)
          .update({
            status: "draft",
            movedToDraftAt: FieldValue.serverTimestamp(),
          })
          .then(() => {
            console.log(`[GhostSystems] (b) Moved product ${productId} to DRAFT.`);
          })
          .catch((err) => {
            console.error(`[GhostSystems] ❌ Error moving ${productId} to DRAFT:`, err);
          });
      });

      if (pendingCount > 0) {
        console.log(`[GhostSystems] ✅ Processed ${pendingCount} pending products in this batch.`);
      }
    },
    (error) => {
      console.error("[GhostSystems] ❌ Listener Error:", error);
    }
  );
}

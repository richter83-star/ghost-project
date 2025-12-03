// autonomous-commerce-pipeline/publishShopify.js
import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

import { createProduct, upsertDigitalGoodsMetafield } from "./services/shopifyService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const COLLECTION = process.env.FIRESTORE_JOBS_COLLECTION || "products";
const LIMIT = Number(process.env.SHOPIFY_PUBLISH_LIMIT || "10");

function initFirebase() {
  if (admin.apps?.length) return admin.app();

  const p = (process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "").trim();
  if (!p) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_PATH");

  const resolved = path.isAbsolute(p) ? p : path.join(__dirname, p);
  if (!fs.existsSync(resolved)) throw new Error(`Service account file not found at: ${resolved}`);

  const serviceAccount = JSON.parse(fs.readFileSync(resolved, "utf8"));

  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log("[Publisher] ✅ Firebase Admin initialized.");
  return admin.app();
}

function buildDigitalContent(job) {
  // Minimal “works today” content for your existing order-paid webhook to email.
  // Replace later with real links/files when Gemini content generation is wired.
  const lines = [];
  lines.push(`Product: ${job.title || "(untitled)"}`);
  lines.push(`Type: ${job.productType || "unknown"}`);
  lines.push("");

  if (job.hooks?.length) {
    lines.push("Hooks:");
    for (const h of job.hooks) lines.push(`- ${h}`);
    lines.push("");
  }

  lines.push("Deliverables:");
  if (job?.payload?.deliverables?.length) {
    for (const d of job.payload.deliverables) lines.push(`- ${d}`);
  } else if (job?.payload?.includes?.length) {
    for (const d of job.payload.includes) lines.push(`- ${d}`);
  } else if (job?.payload?.bundleIncludes) {
    lines.push("- Bundle includes prompt pack + automation kit (see payload in Firestore)");
  } else {
    lines.push("- See product description");
  }

  return lines.join("\n");
}

async function run() {
  const app = initFirebase();
  const db = app.firestore();

  const snap = await db
    .collection(COLLECTION)
    .where("status", "==", "ready_for_shopify")
    .limit(LIMIT)
    .get();

  if (snap.empty) {
    console.log("[Publisher] No ready_for_shopify products found. Exiting.");
    return;
  }

  console.log(`[Publisher] Found ${snap.size} ready_for_shopify products.`);

  for (const doc of snap.docs) {
    const id = doc.id;
    const job = doc.data();

    if (job.shopifyProductId) {
      console.log(`[Publisher] Skipping ${id} (already has shopifyProductId).`);
      continue;
    }

    console.log(`[Publisher] Publishing ${id}: ${job.title || "(no title)"}`);

    try {
      const shopifyProductId = await createProduct(job);
      const content = buildDigitalContent(job);
      await upsertDigitalGoodsMetafield(shopifyProductId, content);

      await doc.ref.update({
        status: "in_shopify",
        shopifyProductId,
        shopifyPublishedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`[Publisher] ✅ Published to Shopify: ${shopifyProductId}`);
    } catch (err) {
      console.error(`[Publisher] ❌ Failed ${id}:`, err?.message || err);
      await doc.ref.update({
        lastError: String(err?.message || err),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
}

(async () => {
  console.log("=================================");
  console.log("     SHOPIFY PUBLISHER JOB       ");
  console.log("=================================");
  try {
    await run();
    console.log("[Publisher] Job complete. Exiting.");
    process.exit(0);
  } catch (e) {
    console.error("[Publisher] ❌ Fatal error:", e);
    process.exit(1);
  }
})();

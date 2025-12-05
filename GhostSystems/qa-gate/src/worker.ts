import { getDb } from "./firestore.js";
import { config } from "./config.js";
import { log } from "./logger.js";
import { evaluateProduct } from "./qa/rubric.js";
import { findDuplicates } from "./qa/dedupe.js";

function parseMoney(v: any): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export async function qaOne(productId: string) {
  const db = getDb();
  const collectionName = config.firestore.collectionName;
  const ref = db.collection(collectionName).doc(productId);
  const doc = await ref.get();

  if (!doc.exists) {
    throw new Error(`product not found: ${productId}`);
  }

  const data = doc.data() as any;

  const product = {
    id: doc.id,
    title: data.title ?? data.name ?? "",
    description: data.description ?? data.body_html ?? "",
    price: parseMoney(data.price ?? data.price_usd),
    product_type: data.product_type ?? data.type,
    prompt_count: data.prompt_count ?? data.promptCount,
    cover_url: data.cover_url ?? data.coverUrl ?? data.image_url ?? data.imageUrl ?? null,
    artifact_path: data.artifact_path ?? data.artifactPath ?? null,
    artifact_url: data.artifact_url ?? data.artifactUrl ?? null,
    product_group_id: data.product_group_id ?? null,
    variant_of: data.variant_of ?? null
  };

  const qa = await evaluateProduct(product);

  // Duplicate detection: fail if duplicates exist and no grouping fields
  const dup = await findDuplicates(db, config.firestore.collectionName, qa.concept_key, doc.id);
  const hasNoGrouping = !product.product_group_id && !product.variant_of;

  let fail_reasons = qa.fail_reasons.slice();
  let score = qa.score;
  let status = qa.status;

  if (hasNoGrouping && dup.duplicates.length > 0) {
    fail_reasons.push("duplicate_concept_without_variants");
    score = Math.max(0, score - 25);
    status = "failed";
  }

  const qaWrite = {
    qa: {
      status,
      score,
      fail_reasons: Array.from(new Set(fail_reasons)),
      checked_at: qa.checked_at,
      concept_key: qa.concept_key,
      duplicates: dup.duplicates
    }
  };

  const update: any = { ...qaWrite };

  if (config.qa.writeStatus) {
    update.status = status === "passed" ? config.qa.passedStatus : config.qa.failedStatus;
  }

  await ref.set(update, { merge: true });

  return { id: doc.id, status, score, fail_reasons: update.qa.fail_reasons };
}

export async function qaSweepOnce() {
  const db = getDb();
  const statuses = config.qa.scanStatuses;

  log.info({ statuses }, "QA sweep starting");

  let processed = 0;

  const collectionName = config.firestore.collectionName;
  
  for (const st of statuses) {
    const snap = await db.collection(collectionName)
      .where("status", "==", st)
      .orderBy("updated_at", "desc")
      .limit(config.qa.batchLimit)
      .get()
      .catch(async () => {
        // fallback if no index on updated_at
        return db.collection(collectionName).where("status", "==", st).limit(config.qa.batchLimit).get();
      });

    for (const doc of snap.docs) {
      const data = doc.data() as any;
      const lastChecked = data?.qa?.checked_at ? String(data.qa.checked_at) : null;

      // Skip if checked in last hour (cheap throttle)
      if (lastChecked) {
        const then = Date.parse(lastChecked);
        if (Number.isFinite(then) && Date.now() - then < 60 * 60 * 1000) continue;
      }

      try {
        const r = await qaOne(doc.id);
        log.info(r, "QA evaluated");
        processed += 1;
      } catch (e: any) {
        log.error({ productId: doc.id, err: e?.message || String(e) }, "QA failed on product");
      }
    }
  }

  log.info({ processed }, "QA sweep done");
  return { processed };
}


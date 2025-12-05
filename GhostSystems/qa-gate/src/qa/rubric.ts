import { containsBannedClaims, looksLikePlaceholderCover, toConceptKey } from "./normalize.js";
import { inspectArtifact } from "./artifacts.js";
import type { QaResult } from "./types.js";

type Product = {
  id: string;
  title?: string;
  description?: string;
  price?: number;
  product_type?: string;
  prompt_count?: number;
  cover_url?: string | null;
  artifact_path?: string | null;
  artifact_url?: string | null;

  // Optional fields used to avoid false positives in dedupe:
  product_group_id?: string | null;
  variant_of?: string | null;
};

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export async function evaluateProduct(product: Product): Promise<QaResult> {
  const fail: string[] = [];
  let score = 100;

  const title = (product.title || "").trim();
  const desc = (product.description || "").trim();
  const concept_key = toConceptKey(title || "untitled");

  // Offer clarity
  if (title.length < 12) { fail.push("title_too_short"); score -= 20; }
  if (title.toLowerCase().includes("product title")) { fail.push("title_placeholder"); score -= 40; }
  if (desc.length < 200) { fail.push("description_too_short"); score -= 20; }

  // Storefront trust: "what's inside" & instructions heuristics
  const dLower = desc.toLowerCase();
  if (!dLower.includes("what") && !dLower.includes("includes") && !dLower.includes("inside")) {
    fail.push("missing_whats_inside_language");
    score -= 10;
  }
  if (!dLower.includes("how to") && !dLower.includes("steps") && !dLower.includes("setup")) {
    // Not always required, but a strong trust signal for digital goods
    score -= 5;
  }

  // Compliance
  const banned = containsBannedClaims(`${title}\n${desc}`);
  if (banned.length > 0) {
    fail.push("banned_claims");
    score -= 40;
  }

  // Asset quality
  if (looksLikePlaceholderCover(product.cover_url ?? null)) {
    fail.push("cover_missing_or_placeholder");
    score -= 25;
  }

  // Deliverable integrity
  const artifact = await inspectArtifact({
    artifact_path: product.artifact_path ?? null,
    artifact_url: product.artifact_url ?? null
  });

  if (!artifact.present) {
    fail.push("artifact_missing");
    score -= 50;
  } else {
    if (artifact.notes.some(n => n.includes("too small"))) {
      fail.push("artifact_too_small");
      score -= 20;
    }
    if (artifact.notes.some(n => n.includes("zip missing README"))) {
      fail.push("readme_missing");
      score -= 20;
    }
  }

  // Content integrity: prompt_count check if detectable
  if (product.prompt_count && artifact.promptCountDetected != null) {
    const expected = product.prompt_count;
    const detected = artifact.promptCountDetected;
    const delta = Math.abs(expected - detected);
    if (delta > 2) { // allow small drift
      fail.push("prompt_count_mismatch");
      score -= 30;
    }
  }

  // Pricing sanity (light touch; you can tighten later)
  if (product.price != null && product.price <= 0) {
    fail.push("price_invalid");
    score -= 25;
  }

  score = clamp(score, 0, 100);

  const status = score >= 80 && fail.length === 0 ? "passed" : "failed";

  return {
    status,
    score,
    fail_reasons: Array.from(new Set(fail)),
    concept_key,
    checked_at: new Date().toISOString(),
    details: {
      artifact
    }
  };
}


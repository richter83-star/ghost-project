const COUNT_MARKERS = ["40", "60", "80", "100", "120", "200"];

export function normalizeWhitespace(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

export function toConceptKey(title: string) {
  // Remove common count markers, parenthetical prompt counts, and trailing qualifiers
  let t = title.toLowerCase();
  t = t.replace(/\(.*?\)/g, " "); // remove parentheses
  for (const c of COUNT_MARKERS) {
    t = t.replace(new RegExp(`\\b${c}\\b`, "g"), " ");
    t = t.replace(new RegExp(`\\b${c}\\s*prompts\\b`, "g"), " ");
  }
  t = t.replace(/\bprompts?\b/g, " ");
  t = t.replace(/[^a-z0-9]+/g, " ");
  t = normalizeWhitespace(t);
  return t;
}

export function looksLikePlaceholderCover(url?: string | null) {
  if (!url) return true;
  const u = url.toLowerCase();
  return (
    u.includes("placehold") ||
    u.includes("dummy") ||
    u.includes("sample") ||
    u.includes("other-bold") || // common Shopify demo assets
    u.includes("cdn.shopify.com") && u.includes("placeholder")
  );
}

export function containsBannedClaims(text: string) {
  const t = text.toLowerCase();
  const banned = [
    "guaranteed profit",
    "guaranteed returns",
    "guarantee profit",
    "risk-free",
    "sure thing",
    "make $",
    "make money fast",
    "100% win",
    "guaranteed win",
    "beat the market"
  ];
  return banned.filter(b => t.includes(b));
}


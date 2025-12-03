# Oracle/brain.py
import os
import random
import hashlib
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import credentials, firestore

# ----------------------------
# Config (env-driven)
# ----------------------------
DEFAULT_COLLECTION = "products"

BATCH_SIZE = int(os.getenv("ORACLE_BATCH_SIZE", "3"))
BUNDLE_RATIO = float(os.getenv("ORACLE_BUNDLE_RATIO", "0.70"))  # heavier bundle default
ORACLE_SEED = os.getenv("ORACLE_SEED", "").strip()
ORACLE_VERSION = os.getenv("ORACLE_VERSION", "oracle_v3_bundle_first")

# Price bands (USD)
PRICE_PROMPT_PACK = (19, 49)
PRICE_AUTOMATION_KIT = (29, 79)
PRICE_BUNDLE = (79, 199)

# Simple cost assumptions (edit later)
# These are NOT facts; they are placeholders to enable ranking decisions.
COST_RANGE_PROMPT_PACK = (0.50, 4.00)      # e.g., image gen + time
COST_RANGE_AUTOMATION_KIT = (1.00, 8.00)   # e.g., LLM time + packaging
COST_RANGE_BUNDLE = (1.50, 12.00)

# "Spicy" hooks stored as optional suggestions
SCARCITY_HOOKS = [
    "Limited-time combo drop",
    "Only chance to grab this pairing",
    "Bundle disappears after the drop window",
    "The playbook people gatekeep",
    "Secrets they do not spell out publicly",
]

STYLE_GUIDE = {
    "image_style": "premium, minimalist, high-contrast, modern SaaS bundle cover",
    "format": "square 1:1",
    "notes": "Strong title typography + abstract tech motif",
}

# ----------------------------
# Curated building blocks
# ----------------------------
NICHES = [
    ("solopreneurs", "one-person operators shipping fast"),
    ("creators", "YouTube/TikTok/newsletter creators"),
    ("agencies", "service businesses packaging ROI"),
    ("ecommerce", "Shopify operators improving conversion"),
    ("b2b_saas", "SaaS founders improving funnel + retention"),
]

PROMPT_PACK_IDEAS = [
    ("Cyber-Noir Product Covers", ["Midjourney", "DALL·E", "SDXL"]),
    ("Luxury Minimalist Bundle Covers", ["Midjourney", "DALL·E", "SDXL"]),
    ("Blueprint / Technical Diagram Aesthetic", ["Midjourney", "DALL·E"]),
    ("Neon Dark UI Illustrations", ["Midjourney", "SDXL"]),
    ("Editorial Tech Photography Prompts", ["Midjourney", "DALL·E"]),
]

AUTOMATION_KIT_IDEAS = [
    ("Notion CRM + Intake Automation", ["Notion", "Gmail", "Calendly"]),
    ("Lead Capture to Follow-up Engine", ["Google Sheets", "Gmail", "Slack"]),
    ("E-commerce Abandoned Cart Revival", ["Shopify", "Klaviyo", "Gmail"]),
    ("Client Onboarding Workflow", ["Typeform", "DocuSign", "Notion"]),
    ("Content Repurposing Pipeline", ["YouTube", "Drive", "Notion"]),
]

AUTOMATION_PLATFORMS = ["n8n", "Make", "Zapier"]

# ----------------------------
# Firebase init
# ----------------------------
def initialize_firebase():
    if firebase_admin._apps:
        return firestore.client()

    key_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "").strip()
    if not key_path:
        raise RuntimeError(
            "Missing FIREBASE_SERVICE_ACCOUNT_PATH (file path like /etc/secrets/KEY_HOME)"
        )

    if not os.path.exists(key_path):
        raise RuntimeError(f"Service account file not found at: {key_path}")

    cred = credentials.Certificate(key_path)
    firebase_admin.initialize_app(cred)
    return firestore.client()

# ----------------------------
# Helpers
# ----------------------------
def now_utc():
    return datetime.now(timezone.utc)

def pick_price(product_type: str) -> int:
    if product_type == "prompt_pack":
        return random.randint(*PRICE_PROMPT_PACK)
    if product_type == "automation_kit":
        return random.randint(*PRICE_AUTOMATION_KIT)
    return random.randint(*PRICE_BUNDLE)

def pick_cost_range(product_type: str):
    if product_type == "prompt_pack":
        return COST_RANGE_PROMPT_PACK
    if product_type == "automation_kit":
        return COST_RANGE_AUTOMATION_KIT
    return COST_RANGE_BUNDLE

def stable_slug(s: str) -> str:
    s = (s or "").strip().lower()
    out = []
    for ch in s:
        if ch.isalnum():
            out.append(ch)
        elif ch in (" ", "-", "_", "+", ".", "·", "’", "'"):
            out.append("-")
    slug = "".join(out)
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug.strip("-")

def make_dedupe_key(product_type: str, niche: str, *parts: str) -> str:
    # Stable key so reruns don't explode the DB
    base = ":".join([product_type, niche] + [stable_slug(p) for p in parts if p])
    return base

def doc_id_from_dedupe(dedupe_key: str) -> str:
    return hashlib.sha1(dedupe_key.encode("utf-8")).hexdigest()

def base_product_fields(product_type: str, niche_key: str) -> dict:
    # Snake_case primary schema plus backward-compatible aliases
    return {
        "product_type": product_type,
        "productType": product_type,  # compatibility
        "niche": niche_key,
        "is_digital": True,
        "digital": True,  # compatibility
        "requires_shipping": False,
        "requiresShipping": False,  # compatibility
        "currency": "USD",
        "source": "oracle",
        "version": ORACLE_VERSION,
        "status": "pending",
        # Use Firestore timestamps server-side for consistency
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }

def build_prompt_pack(niche_key: str, niche_desc: str) -> dict:
    theme, models = random.choice(PROMPT_PACK_IDEAS)
    pack_count = random.choice([50, 75, 100])  # stabilize a bit to reduce clone spam

    title = f"{theme} Prompt Pack ({pack_count} prompts)"
    description = (
        f"A premium prompt pack for {niche_desc}. "
        "Includes variations, negative prompts, and composition controls to generate consistent, sellable images."
    )

    image_prompt = (
        f"Minimalist premium product cover, title '{theme}', subtitle 'Prompt Pack', "
        "dark background, abstract tech motif, sharp typography, high contrast, studio lighting"
    )

    product = {
        **base_product_fields("prompt_pack", niche_key),
        "title": title,
        "description": description,
        "price_usd": pick_price("prompt_pack"),
        "tags": ["prompt_pack", "ai_images", "digital", niche_key],
        "payload": {
            "models": models,
            "prompt_count": pack_count,
            "includes": ["style guide", "negative prompts", "composition recipes", "bonus variants"],
            "deliverables": ["prompt-pack.txt", "prompt-pack.pdf", "readme.md"],
        },
        "image": {"prompt": image_prompt, **STYLE_GUIDE},
    }

    # Decision metrics placeholders
    lo, hi = pick_cost_range("prompt_pack")
    product["metrics"] = {
        "cogs_est_usd_range": [lo, hi],
        "profit_est_usd_range": [product["price_usd"] - hi, product["price_usd"] - lo],
        "time_on_shelf_est_days": random.choice([3, 7, 14, 21]),
        "bundle_fit_score_0_10": random.choice([7, 8, 9]),
    }

    # Stable dedupe key (theme + niche)
    product["dedupe_key"] = make_dedupe_key("prompt_pack", niche_key, theme, str(pack_count))
    return product

def build_automation_kit(niche_key: str, niche_desc: str) -> dict:
    kit_name, integrations = random.choice(AUTOMATION_KIT_IDEAS)
    platform = random.choice(AUTOMATION_PLATFORMS)

    title = f"{kit_name} ({platform} Automation Kit)"
    description = (
        f"A plug-and-play automation kit for {niche_desc}. "
        f"Built for {platform}. Includes setup docs, workflow export, and a validation checklist."
    )

    image_prompt = (
        f"Minimalist premium product cover, title '{kit_name}', subtitle '{platform} Automation Kit', "
        "dark background, diagram lines, abstract workflow nodes, modern typography, high contrast"
    )

    product = {
        **base_product_fields("automation_kit", niche_key),
        "title": title,
        "description": description,
        "price_usd": pick_price("automation_kit"),
        "tags": ["automation_kit", platform, "digital", niche_key],
        "payload": {
            "platform": platform,
            "integrations": integrations,
            "includes": ["workflow.json", "setup.md", "qa-checklist.md", "troubleshooting.md"],
            "time_to_deploy_minutes": random.choice([20, 30, 45, 60]),
        },
        "image": {"prompt": image_prompt, **STYLE_GUIDE},
    }

    lo, hi = pick_cost_range("automation_kit")
    product["metrics"] = {
        "cogs_est_usd_range": [lo, hi],
        "profit_est_usd_range": [product["price_usd"] - hi, product["price_usd"] - lo],
        "time_on_shelf_est_days": random.choice([7, 14, 30]),
        "bundle_fit_score_0_10": random.choice([7, 8, 9]),
    }

    # Stable dedupe key (kit + platform + niche)
    product["dedupe_key"] = make_dedupe_key("automation_kit", niche_key, kit_name, platform)
    return product

def build_bundle(niche_key: str, niche_desc: str) -> dict:
    # Build components (embedded, not separate SKUs)
    prompt_pack = build_prompt_pack(niche_key, niche_desc)
    automation_kit = build_automation_kit(niche_key, niche_desc)

    theme = prompt_pack["title"]
    kit = automation_kit["title"]

    bundle_title = f"High-Ticket Bundle: Visuals + Automation ({niche_key})"
    bundle_description = (
        f"A premium bundle for {niche_desc}: "
        "a sellable image prompt pack plus a deployable automation kit. "
        "Designed to be bought together so the buyer gets results faster."
    )

    image_prompt = (
        f"Premium bundle product cover, title '{bundle_title}', subtitle 'Prompt Pack + Automation Kit', "
        "dark luxury minimalist design, abstract tech + creative motif, bold typography, high contrast"
    )

    marketing_copy = [
        "Limited-time bundle drop.",
        "Get the visuals and the engine in one purchase.",
        "Designed to ship results fast.",
        random.choice(SCARCITY_HOOKS) + ".",
    ]

    product = {
        **base_product_fields("bundle", niche_key),
        "title": bundle_title,
        "description": bundle_description,
        "price_usd": pick_price("bundle"),
        "tags": ["bundle", "high_ticket", "digital", niche_key],
        "hooks": marketing_copy,
        "payload": {
            "bundle_includes": {
                "prompt_pack": prompt_pack["payload"],
                "automation_kit": automation_kit["payload"],
            },
            "positioning": "Premium pairing: prompts + workflows",
            "scarcity": {"mode": "drop", "note": "Optional storefront copy guidance."},
        },
        "image": {"prompt": image_prompt, **STYLE_GUIDE},
        "bundle_components_meta": {
            "prompt_pack_title": prompt_pack["title"],
            "automation_kit_title": automation_kit["title"],
        },
    }

    # Metrics: anchor value vs bundle price
    anchor = prompt_pack["price_usd"] + automation_kit["price_usd"]
    lo, hi = pick_cost_range("bundle")
    product["metrics"] = {
        "anchor_value_usd": anchor,
        "discount_vs_anchor_usd": max(0, anchor - product["price_usd"]),
        "cogs_est_usd_range": [lo, hi],
        "profit_est_usd_range": [product["price_usd"] - hi, product["price_usd"] - lo],
        "time_on_shelf_est_days": random.choice([3, 7, 14]),  # bundles should churn faster
        "bundle_fit_score_0_10": 9,
    }

    # Stable dedupe: niche + prompt theme + kit name/platform under the hood
    product["dedupe_key"] = make_dedupe_key(
        "bundle",
        niche_key,
        prompt_pack["dedupe_key"],
        automation_kit["dedupe_key"],
    )
    return product

def upsert_product(db, collection_name: str, product: dict) -> str:
    dedupe_key = product.get("dedupe_key")
    if not dedupe_key:
        raise RuntimeError("product missing dedupe_key")

    doc_id = doc_id_from_dedupe(dedupe_key)
    doc_ref = db.collection(collection_name).document(doc_id)

    # If already exists, do nothing (prevents spam)
    if doc_ref.get().exists:
        return ""

    doc_ref.set(product, merge=False)
    return doc_id

# ----------------------------
# Main
# ----------------------------
def main():
    if ORACLE_SEED:
        random.seed(ORACLE_SEED)

    print(f"[Oracle] started {now_utc().isoformat()}")
    collection_name = os.getenv("FIRESTORE_JOBS_COLLECTION", DEFAULT_COLLECTION)

    db = initialize_firebase()

    created = 0
    attempts = 0

    while created < BATCH_SIZE and attempts < BATCH_SIZE * 8:
        attempts += 1
        niche_key, niche_desc = random.choice(NICHES)

        if random.random() < BUNDLE_RATIO:
            product = build_bundle(niche_key, niche_desc)
        else:
            product = build_prompt_pack(niche_key, niche_desc) if random.random() < 0.5 else build_automation_kit(niche_key, niche_desc)

        doc_id = upsert_product(db, collection_name, product)
        if doc_id:
            created += 1
            print(f"[Oracle] Created {product['product_type']} -> {doc_id} :: {product['title']}")

    print(f"[Oracle] finished {now_utc().isoformat()} | created={created}")

if __name__ == "__main__":
    main()

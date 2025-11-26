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

BATCH_SIZE = int(os.getenv("ORACLE_BATCH_SIZE", "3"))  # how many products per run
BUNDLE_RATIO = float(os.getenv("ORACLE_BUNDLE_RATIO", "0.65"))  # probability bundle
ORACLE_SEED = os.getenv("ORACLE_SEED", "")  # optional deterministic seed
ORACLE_VERSION = "oracle_v2_bundle_first"

# Price bands (USD) - tune later
PRICE_PROMPT_PACK = (19, 49)
PRICE_AUTOMATION_KIT = (29, 79)
PRICE_BUNDLE = (79, 199)

# "Spicy" hooks (you asked for these). We'll store them as suggestions, not as enforced copy.
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
    "notes": "Shop with their eyes: strong title typography + abstract tech motif",
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

# Prompt-pack themes are "digital AI goods" and visually marketable
PROMPT_PACK_IDEAS = [
    ("Cyber-Noir Product Covers", ["Midjourney", "DALL·E", "SDXL"]),
    ("Luxury Minimalist Bundle Covers", ["Midjourney", "DALL·E", "SDXL"]),
    ("Blueprint / Technical Diagram Aesthetic", ["Midjourney", "DALL·E"]),
    ("Neon Dark UI Illustrations", ["Midjourney", "SDXL"]),
    ("Editorial Tech Photography Prompts", ["Midjourney", "DALL·E"]),
]

# Automation kits should be *shippable digital assets*
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
        raise RuntimeError("Missing FIREBASE_SERVICE_ACCOUNT_PATH (should be a file path, e.g. /etc/secrets/KEY_HOME)")

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

def fingerprint(obj: dict) -> str:
    # Stable-ish uniqueness key to prevent spam duplicates
    raw = f"{obj.get('productType','')}|{obj.get('niche','')}|{obj.get('title','')}|{obj.get('version','')}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()

def build_prompt_pack(niche_key: str, niche_desc: str) -> dict:
    theme, models = random.choice(PROMPT_PACK_IDEAS)
    pack_count = random.choice([40, 60, 80, 100])

    title = f"{theme} Prompt Pack ({pack_count} prompts)"
    description = (
        f"A premium prompt pack for {niche_desc}. "
        f"Includes variations, negative prompts, and composition controls to generate consistent, sellable images."
    )

    image_prompt = (
        f"Minimalist premium product cover, title '{title}', subtitle 'Prompt Pack', "
        f"dark background, abstract tech motif, sharp typography, high contrast, studio lighting"
    )

    return {
        "productType": "prompt_pack",
        "niche": niche_key,
        "title": title,
        "description": description,
        "price": pick_price("prompt_pack"),
        "digital": True,
        "requiresShipping": False,
        "tags": ["prompt_pack", "ai_images", "digital", niche_key],
        "payload": {
            "models": models,
            "promptCount": pack_count,
            "includes": ["style guide", "negative prompts", "composition recipes", "bonus variants"],
            "deliverables": ["prompt-pack.txt", "prompt-pack.pdf", "readme.md"],
        },
        "image": {
            "prompt": image_prompt,
            **STYLE_GUIDE,
        },
    }

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
        f"dark background, diagram lines, abstract workflow nodes, modern typography, high contrast"
    )

    return {
        "productType": "automation_kit",
        "niche": niche_key,
        "title": title,
        "description": description,
        "price": pick_price("automation_kit"),
        "digital": True,
        "requiresShipping": False,
        "tags": ["automation_kit", platform, "digital", niche_key],
        "payload": {
            "platform": platform,
            "integrations": integrations,
            "includes": ["workflow.json", "setup.md", "qa-checklist.md", "troubleshooting.md"],
            "timeToDeployMinutes": random.choice([20, 30, 45, 60]),
        },
        "image": {
            "prompt": image_prompt,
            **STYLE_GUIDE,
        },
    }

def build_bundle(niche_key: str, niche_desc: str) -> dict:
    # Bundle pairs: prompt pack + automation kit
    prompt_pack = build_prompt_pack(niche_key, niche_desc)
    automation_kit = build_automation_kit(niche_key, niche_desc)

    # Clean bundle title: one strong promise
    bundle_title = f"High-Ticket Growth Bundle: Visuals + Automation ({niche_key})"
    bundle_description = (
        f"A premium bundle for {niche_desc}: "
        f"1) a sellable image prompt pack + 2) a deployable automation kit. "
        f"Designed to be bought together so the buyer gets results faster."
    )

    image_prompt = (
        f"Premium bundle product cover, title '{bundle_title}', subtitle 'Prompt Pack + Automation Kit', "
        f"dark luxury minimalist design, abstract tech + creative motif, bold typography, high contrast"
    )

    # Marketing copy suggestions stored as data (not forced)
    marketing_copy = [
        "Limited-time bundle drop.",
        "Get the visuals and the engine in one purchase.",
        "Designed to ship results fast.",
        random.choice(SCARCITY_HOOKS) + ".",
    ]

    return {
        "productType": "bundle",
        "niche": niche_key,
        "title": bundle_title,
        "description": bundle_description,
        "price": pick_price("bundle"),
        "digital": True,
        "requiresShipping": False,
        "tags": ["bundle", "high_ticket", "digital", niche_key],
        "hooks": marketing_copy,
        "payload": {
            "bundleIncludes": {
                "prompt_pack": prompt_pack["payload"],
                "automation_kit": automation_kit["payload"],
            },
            "positioning": "Premium pairing: prompts + workflows",
            "scarcity": {
                "mode": "drop",
                "note": "Use in storefront copy if desired (optional).",
            },
        },
        "image": {
            "prompt": image_prompt,
            **STYLE_GUIDE,
        },
    }

def upsert_product(db, collection_name: str, product: dict) -> str:
    product["status"] = "pending"
    product["createdAt"] = now_utc()
    product["updatedAt"] = now_utc()
    product["source"] = "oracle"
    product["version"] = ORACLE_VERSION

    fp = fingerprint(product)
    doc_ref = db.collection(collection_name).document(fp)

    existing = doc_ref.get()
    if existing.exists:
        # Avoid spewing duplicates
        return ""

    doc_ref.set(product, merge=False)
    return fp


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

    while created < BATCH_SIZE and attempts < BATCH_SIZE * 5:
        attempts += 1
        niche_key, niche_desc = random.choice(NICHES)

        if random.random() < BUNDLE_RATIO:
            product = build_bundle(niche_key, niche_desc)
        else:
            # non-bundle: still digital-only
            product = build_prompt_pack(niche_key, niche_desc) if random.random() < 0.5 else build_automation_kit(niche_key, niche_desc)

        doc_id = upsert_product(db, collection_name, product)
        if doc_id:
            created += 1
            print(f"[Oracle] Created {product['productType']} -> {doc_id} :: {product['title']}")

    print(f"[Oracle] finished {now_utc().isoformat()} | created={created}")

if __name__ == "__main__":
    main()

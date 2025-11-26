import os
import random
import hashlib
from datetime import datetime, timezone
from typing import Dict, Any, List

import firebase_admin
from firebase_admin import credentials, firestore


# -----------------------------
# Config
# -----------------------------
DEFAULT_COLLECTION = os.environ.get("FIRESTORE_JOBS_COLLECTION", "products")
SERVICE_ACCOUNT_PATH = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH", "oracle_service_account.json")

# How many product docs to create per run
ORACLE_CREATE_COUNT = int(os.environ.get("ORACLE_CREATE_COUNT", "1"))

# Percent chance we create a bundle vs a single product
BUNDLE_WEIGHT = float(os.environ.get("ORACLE_BUNDLE_WEIGHT", "0.80"))  # 0.80 = 80%

# Marketing tone: "clean" (default) or "spicy"
MARKETING_TONE = os.environ.get("ORACLE_MARKETING_TONE", "spicy").strip().lower()

# A simple throttle key to reduce repeats. If present, we include it in the seed hash.
RUN_SALT = os.environ.get("ORACLE_RUN_SALT", "")


# -----------------------------
# Firebase init
# -----------------------------
def initialize_firebase():
    """
    Initializes Firebase Admin SDK and returns Firestore client.
    Uses Render Secret File path in FIREBASE_SERVICE_ACCOUNT_PATH.
    """
    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        print(f"[Oracle] ERROR: Service account key file not found at: {SERVICE_ACCOUNT_PATH}")
        print("[Oracle] Add it as a Render Secret File and set FIREBASE_SERVICE_ACCOUNT_PATH to that path.")
        return None

    try:
        if not firebase_admin._apps:
            cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
            firebase_admin.initialize_app(cred)
            print("[Oracle] ✅ Firebase Admin initialized.")
        else:
            print("[Oracle] ✅ Firebase Admin already initialized.")
        return firestore.client()
    except Exception as e:
        print(f"[Oracle] ERROR initializing Firebase: {e}")
        return None


# -----------------------------
# Product generation (digital-only, bundle-first)
# -----------------------------
def _now():
    return datetime.now(timezone.utc)


def _slug_hash(text: str) -> str:
    h = hashlib.sha256(text.encode("utf-8")).hexdigest()
    return h[:12]


def _hooks() -> List[str]:
    # Keep these as marketing hooks, but not outright scammy.
    base = [
        "Instant digital access. No shipping.",
        "Built for speed: copy, paste, deploy.",
        "High-leverage templates you can reuse forever.",
    ]
    if MARKETING_TONE == "spicy":
        base += [
            "Limited-time bundle drop.",
            "Only chance to grab this combo (for now).",
            "Playbooks most people never standardize.",
        ]
    else:
        base += [
            "Bundle & save (limited window).",
            "Founder bundle pricing.",
        ]
    return base


def _pricing_for(kind: str) -> float:
    # Heuristic ranges (not “truth”; just defaults you can tune)
    if kind == "prompt_pack":
        return round(random.uniform(19, 49), 2)
    if kind == "automation_kit":
        return round(random.uniform(39, 99), 2)
    if kind == "bundle":
        # Price to feel premium
        return round(random.uniform(119, 299), 2)
    return round(random.uniform(19, 79), 2)


def _digital_image_placeholder(title: str) -> str:
    # Temporary placeholder image until image generation is wired in
    safe = title.replace(" ", "+")[:60]
    return f"https://placehold.co/1024x1024/0f172a/ffffff?text={safe}"


def build_bundle_blueprints() -> List[Dict[str, Any]]:
    # Core thesis: premium bundle = prompt pack + automation kit that compliment each other
    return [
        {
            "bundleName": "Creator Growth Engine Bundle",
            "niche": "creators",
            "promptPack": {
                "title": "Content Hooks + Angle Matrix Prompt Pack",
                "productType": "prompt_pack",
                "description": "A curated prompt pack to generate high-retention hooks, angles, and thumbnails ideas across niches.",
                "deliverable": "prompts_md",
            },
            "automationKit": {
                "title": "Notion Content OS + Weekly Planning Automation Kit",
                "productType": "automation_kit",
                "description": "A Notion workspace + automation checklist to plan, draft, and publish content consistently.",
                "deliverable": "notion_template_link + checklist_pdf",
            },
        },
        {
            "bundleName": "E-commerce Lifecycle Revenue Bundle",
            "niche": "ecommerce",
            "promptPack": {
                "title": "Email + SMS Copy Prompt Pack (Lifecycle)",
                "productType": "prompt_pack",
                "description": "Prompts to generate welcome, abandoned cart, post-purchase, winback, and upsell flows.",
                "deliverable": "prompts_md",
            },
            "automationKit": {
                "title": "Lifecycle Flows Automation Kit (Klaviyo-ready)",
                "productType": "automation_kit",
                "description": "Flow maps, segmentation rules, and plug-and-play templates for lifecycle revenue.",
                "deliverable": "flow_maps_pdf + templates_txt",
            },
        },
        {
            "bundleName": "Agency Client Acquisition Bundle",
            "niche": "agencies",
            "promptPack": {
                "title": "Outbound Messaging Prompt Pack (Cold + Warm)",
                "productType": "prompt_pack",
                "description": "Prompts for personalized cold outreach, follow-ups, and objection handling.",
                "deliverable": "prompts_md",
            },
            "automationKit": {
                "title": "Lead Intake + Proposal Automation Kit",
                "productType": "automation_kit",
                "description": "Client intake form blueprint + proposal generator structure + follow-up system.",
                "deliverable": "templates_doc + checklist_pdf",
            },
        },
        {
            "bundleName": "AI Art Business Bundle",
            "niche": "ai_art",
            "promptPack": {
                "title": "Cyber-Noir Visual Prompt Pack (V6)",
                "productType": "prompt_pack",
                "description": "High-quality prompts for consistent cyber-noir outputs across scenes, characters, and styles.",
                "deliverable": "prompts_md",
            },
            "automationKit": {
                "title": "Listing + Upsell Automation Kit (Digital Storefront)",
                "productType": "automation_kit",
                "description": "Templates and workflow to list digital packs, bundle offers, and upsells.",
                "deliverable": "workflow_pdf + templates_txt",
            },
        },
    ]


def make_bundle_doc(blueprint: Dict[str, Any]) -> Dict[str, Any]:
    bundle_title = blueprint["bundleName"]
    bundle_price = _pricing_for("bundle")

    prompt_title = blueprint["promptPack"]["title"]
    kit_title = blueprint["automationKit"]["title"]

    seed_key = _slug_hash(f"{bundle_title}|{prompt_title}|{kit_title}|{RUN_SALT}")

    return {
        # Identity / routing
        "status": "pending",
        "deliveryType": "digital",
        "productType": "bundle",
        "collection": "ghost_digital",
        "seedKey": seed_key,

        # Merchandising
        "title": bundle_title,
        "subtitle": f"Prompt Pack + Automation Kit ({blueprint['niche']})",
        "description": (
            f"A premium bundle pairing:\n"
            f"1) {prompt_title}\n"
            f"2) {kit_title}\n\n"
            f"Designed to ship fast and sell high. Digital-only."
        ),
        "hooks": _hooks(),

        # Bundle composition
        "bundle": {
            "components": [
                {
                    "productType": blueprint["promptPack"]["productType"],
                    "title": prompt_title,
                    "description": blueprint["promptPack"]["description"],
                    "deliverable": blueprint["promptPack"]["deliverable"],
                },
                {
                    "productType": blueprint["automationKit"]["productType"],
                    "title": kit_title,
                    "description": blueprint["automationKit"]["description"],
                    "deliverable": blueprint["automationKit"]["deliverable"],
                },
            ],
            "bundleStrategy": "complimentary_pair",
        },

        # Pricing
        "price": bundle_price,
        "currency": "USD",

        # Image placeholders for now
        "imageUrl": _digital_image_placeholder(bundle_title),
        "imagePrompt": f"Modern premium digital product cover for '{bundle_title}', minimal, dark navy, electric accent, no physical objects.",

        # Metrics (heuristics; tune later)
        "metrics": {
            "profitability_range_usd": [round(bundle_price * 0.85, 2), round(bundle_price * 0.98, 2)],
            "expected_shelf_life_days": random.choice([14, 21, 30, 45]),
            "demand_signal": random.choice(["med", "med_high", "high"]),
            "confidence": "low",
        },

        # Timestamps
        "createdAt": _now(),
        "updatedAt": _now(),
        "source": "oracle_brain_py",
        "version": "2.0.0",
    }


def make_single_doc(kind: str) -> Dict[str, Any]:
    # Singles are still digital, but we prefer bundles
    ideas = {
        "prompt_pack": [
            ("Hook Formula Prompt Pack", "Prompts to generate hooks that stop the scroll across niches."),
            ("High-Converting Landing Page Prompt Pack", "Prompts for headlines, offers, positioning, and FAQs."),
            ("Short-Form Script Prompt Pack", "Prompts to generate 30-90s scripts with CTAs."),
        ],
        "automation_kit": [
            ("Client Onboarding Automation Kit", "Templates + workflow for onboarding clients with less back-and-forth."),
            ("Email Sequence Automation Kit", "Template pack + flow map to ship lifecycle emails fast."),
            ("Notion Business OS Kit", "A digital system to run tasks, pipeline, and knowledge in one place."),
        ],
    }

    title, desc = random.choice(ideas[kind])
    price = _pricing_for(kind)
    seed_key = _slug_hash(f"{kind}|{title}|{RUN_SALT}")

    return {
        "status": "pending",
        "deliveryType": "digital",
        "productType": kind,
        "collection": "ghost_digital",
        "seedKey": seed_key,

        "title": title,
        "description": desc + " Digital-only. Instant delivery.",
        "hooks": _hooks(),

        "price": price,
        "currency": "USD",

        "imageUrl": _digital_image_placeholder(title),
        "imagePrompt": f"Premium digital product cover for '{title}', minimal, dark navy, electric accent, no physical objects.",

        "metrics": {
            "profitability_range_usd": [round(price * 0.85, 2), round(price * 0.98, 2)],
            "expected_shelf_life_days": random.choice([10, 14, 21, 30]),
            "demand_signal": random.choice(["med", "med_high"]),
            "confidence": "low",
        },

        "createdAt": _now(),
        "updatedAt": _now(),
        "source": "oracle_brain_py",
        "version": "2.0.0",
    }


def upsert_if_new(db, collection_name: str, doc_data: Dict[str, Any]) -> bool:
    """
    Prevent spam duplicates. If a doc with same seedKey exists and is not archived, skip creation.
    """
    seed_key = doc_data.get("seedKey")
    if not seed_key:
        return True  # no seedKey -> allow

    existing = (
        db.collection(collection_name)
        .where("seedKey", "==", seed_key)
        .where("status", "in", ["pending", "draft", "ready_for_shopify"])
        .limit(1)
        .get()
    )
    if existing:
        print(f"[Oracle] ⏭️ Skipping duplicate seedKey={seed_key} (already active).")
        return False

    db.collection(collection_name).add(doc_data)
    print(f"[Oracle] ✅ Created product: {doc_data.get('title')} (type={doc_data.get('productType')})")
    return True


def generate_products(db, collection_name: str, count: int):
    blueprints = build_bundle_blueprints()

    created = 0
    attempts = 0
    max_attempts = max(10, count * 5)

    while created < count and attempts < max_attempts:
        attempts += 1

        if random.random() < BUNDLE_WEIGHT:
            bp = random.choice(blueprints)
            doc_data = make_bundle_doc(bp)
        else:
            kind = random.choice(["prompt_pack", "automation_kit"])
            doc_data = make_single_doc(kind)

        if upsert_if_new(db, collection_name, doc_data):
            created += 1

    print(f"[Oracle] Done. Created {created}/{count} products.")


def main():
    print(f"[Oracle] brain.py started at {_now().isoformat()}")
    print(f"[Oracle] Target collection: {DEFAULT_COLLECTION}")
    print(f"[Oracle] Create count: {ORACLE_CREATE_COUNT} | Bundle weight: {BUNDLE_WEIGHT} | Tone: {MARKETING_TONE}")

    db = initialize_firebase()
    if not db:
        print("[Oracle] Firestore client unavailable. Exiting with error.")
        raise SystemExit(1)

    generate_products(db, DEFAULT_COLLECTION, ORACLE_CREATE_COUNT)

    print(f"[Oracle] brain.py finished at {_now().isoformat()}")


if __name__ == "__main__":
    main()

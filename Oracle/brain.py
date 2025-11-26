# Oracle/brain.py
import os
import json
import random
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import credentials, firestore


# ----------------------------
# Firebase init (Admin SDK)
# ----------------------------
def initialize_firebase():
    """
    Supports either:
      1) FIREBASE_SERVICE_ACCOUNT_PATH -> path to a JSON key file (Render Secret File path)
      2) FIREBASE_SERVICE_ACCOUNT_JSON -> raw JSON string (less common; still supported)
    """
    if firebase_admin._apps:
        return firestore.client()

    sa_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
    sa_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH", "").strip()

    if sa_json:
        try:
            info = json.loads(sa_json)
            cred = credentials.Certificate(info)
            firebase_admin.initialize_app(cred)
            print("[Oracle] ✅ Firebase Admin initialized from FIREBASE_SERVICE_ACCOUNT_JSON")
            return firestore.client()
        except Exception as e:
            print(f"[Oracle] ❌ Failed to init Firebase from FIREBASE_SERVICE_ACCOUNT_JSON: {e}")
            return None

    if not sa_path:
        sa_path = "oracle_service_account.json"  # optional local fallback name

    if not os.path.exists(sa_path):
        print(f"[Oracle] ❌ Service account key file not found at: {sa_path}")
        print("[Oracle]    Set FIREBASE_SERVICE_ACCOUNT_PATH to the Render Secret File path.")
        return None

    try:
        cred = credentials.Certificate(sa_path)
        firebase_admin.initialize_app(cred)
        print("[Oracle] ✅ Firebase Admin initialized from FIREBASE_SERVICE_ACCOUNT_PATH")
        return firestore.client()
    except Exception as e:
        print(f"[Oracle] ❌ Failed to init Firebase from file path: {e}")
        return None


# ----------------------------
# Product generation rules
# ----------------------------
CURRENCY = "USD"
COLLECTION = os.environ.get("FIRESTORE_PRODUCTS_COLLECTION", "products")

# You wanted digital-only: enforce it at the source.
DELIVERY_TYPE = "digital"

# Heavily biased toward bundles (high price, higher AOV).
PRODUCT_TYPE_WEIGHTS = [
    ("bundle", 0.55),
    ("automation_kit", 0.30),
    ("prompt_pack", 0.15),
]

SECRET_HOOKS = [
    "Limited-time bundle drop",
    "Only chance to grab this combo",
    "Playbook they don't want you to have",
    "Founder-grade system in a box",
    "Steal my workflow (ethically)",
    "Unfair advantage kit",
]

NICHES = [
    "creator economy",
    "ecommerce",
    "agency ops",
    "productivity",
    "personal brand",
    "AI content",
]


PROMPT_PACKS = [
    {
        "base_title": "Midjourney V6 Cyber-Noir Prompt Pack",
        "tags": ["midjourney", "prompt pack", "cyber noir", "ai art"],
        "digital_content": "Includes: 60 image prompts + 10 style recipes + 5 upscale presets.\nUse: paste prompts into Midjourney / similar tools.\nBonus: 'Consistency' mini-guide.",
        "image_prompt": "Futuristic cyber-noir moodboard, neon rain, cinematic lighting, high contrast, sleek typography, digital product cover",
    },
    {
        "base_title": "ChatGPT High-Converting Landing Page Prompt Pack",
        "tags": ["chatgpt", "copywriting", "landing page", "prompts"],
        "digital_content": "Includes: 40 prompts for hooks, offers, FAQs, objection handling, and A/B variants.\nBonus: 10 'limited-time' angle templates.",
        "image_prompt": "Minimalist dark tech cover, electric purple accent, crisp typography, 'Prompt Pack' label, modern ecommerce style",
    },
    {
        "base_title": "YouTube Script Hooks Prompt Pack (Tech + AI)",
        "tags": ["youtube", "scripts", "hooks", "prompts"],
        "digital_content": "Includes: 100 hook formulas + 25 cold-open templates + 10 retention loops.\nBonus: pacing guide + CTA library.",
        "image_prompt": "Bold modern cover, dark background, high contrast title, play button motif abstract, digital product design",
    },
]

AUTOMATION_KITS = [
    {
        "base_title": "Ultimate Notion CRM System (Templates + SOPs)",
        "tags": ["notion", "crm", "templates", "operations"],
        "digital_content": "Includes: Notion CRM template + pipeline views + onboarding SOPs + follow-up sequences.\nBonus: KPI dashboard + daily workflow.",
        "image_prompt": "Clean SaaS-style dashboard mock cover, dark mode UI, minimal, professional, digital template kit",
    },
    {
        "base_title": "E-commerce Email Automation Kit (Welcome + Abandon + Winback)",
        "tags": ["ecommerce", "email", "automation", "klaviyo", "shopify"],
        "digital_content": "Includes: 12 email templates + flow map (welcome/abandon/winback) + segmentation rules.\nBonus: subject line bank.",
        "image_prompt": "Email flow diagram aesthetic, dark theme, modern arrows, digital kit packaging design",
    },
    {
        "base_title": "Freelance Client Onboarding Workflow (Contracts + Checklist + Emails)",
        "tags": ["freelance", "onboarding", "workflow", "operations"],
        "digital_content": "Includes: onboarding checklist + email sequence + intake form + project kickoff SOP.\nBonus: scope-control scripts.",
        "image_prompt": "Minimal pro cover, checklist motif, dark theme, clean typography, digital workflow kit",
    },
]

# Bundle mapping: pair prompt_pack + automation_kit
BUNDLES = [
    {
        "title": "Creator Growth Bundle: Hooks + Funnel System",
        "prompt_pack_index": 2,     # YouTube hooks
        "automation_kit_index": 0,  # Notion CRM
        "tags": ["bundle", "creator", "growth", "system"],
    },
    {
        "title": "E-commerce Revenue Bundle: Copy Prompts + Email Automation",
        "prompt_pack_index": 1,     # Landing page prompts
        "automation_kit_index": 1,  # Email automation kit
        "tags": ["bundle", "ecommerce", "conversion", "automation"],
    },
    {
        "title": "Client Machine Bundle: Sales Page Prompts + Onboarding Workflow",
        "prompt_pack_index": 1,     # Landing page prompts
        "automation_kit_index": 2,  # Onboarding workflow
        "tags": ["bundle", "agency", "ops", "automation"],
    },
]


def weighted_choice(weighted_items):
    r = random.random()
    cumulative = 0.0
    for item, w in weighted_items:
        cumulative += w
        if r <= cumulative:
            return item
    return weighted_items[-1][0]


def estimate_metrics(product_type, price):
    # Rough internal cost estimate for API calls + infra per item (kept tiny but non-zero)
    cost_low = 0.50
    cost_high = 3.00 if product_type == "bundle" else 2.00

    # Popularity shelf-life estimate (how long it stays "fresh" as an offer)
    # Bundles: shorter, because scarcity angle works best in bursts.
    if product_type == "bundle":
        pop_days = random.randint(3, 10)
    else:
        pop_days = random.randint(7, 30)

    profit_low = round(max(0.0, price - cost_high), 2)
    profit_high = round(max(0.0, price - cost_low), 2)

    return {
        "estimatedCostRangeUsd": [cost_low, cost_high],
        "profitabilityRangeUsd": [profit_low, profit_high],
        "popularityEstimateDays": pop_days,
    }


def build_prompt_pack():
    base = random.choice(PROMPT_PACKS)
    price = round(random.choice([12.00, 17.00, 24.00, 29.00]), 2)

    hook = random.choice(SECRET_HOOKS)
    niche = random.choice(NICHES)

    title = f"{base['base_title']} ({niche})"
    description = (
        f"{hook}. Digital prompt pack designed for {niche}. "
        "Instant download. No physical items. Includes clear instructions."
    )

    metrics = estimate_metrics("prompt_pack", price)

    return {
        "title": title,
        "description": description,
        "productType": "prompt_pack",
        "deliveryType": DELIVERY_TYPE,
        "price": price,
        "currency": CURRENCY,
        "tags": list(set(base["tags"] + [niche, "digital"])),
        "marketingHooks": [hook, "Instant download", "Limited-time angles included"],
        "imagePrompt": base["image_prompt"],
        "digitalContent": base["digital_content"],
        **metrics,
    }


def build_automation_kit():
    base = random.choice(AUTOMATION_KITS)
    price = round(random.choice([39.00, 59.00, 79.00, 119.00, 149.00]), 2)

    hook = random.choice(SECRET_HOOKS)
    niche = random.choice(NICHES)

    title = f"{base['base_title']} ({niche})"
    description = (
        f"{hook}. A complete automation kit for {niche}. "
        "Templates + SOPs + scripts. Digital delivery only."
    )

    metrics = estimate_metrics("automation_kit", price)

    return {
        "title": title,
        "description": description,
        "productType": "automation_kit",
        "deliveryType": DELIVERY_TYPE,
        "price": price,
        "currency": CURRENCY,
        "tags": list(set(base["tags"] + [niche, "digital"])),
        "marketingHooks": [hook, "Systemized workflow", "Plug-and-play templates"],
        "imagePrompt": base["image_prompt"],
        "digitalContent": base["digital_content"],
        **metrics,
    }


def build_bundle():
    bundle = random.choice(BUNDLES)
    prompt_pack = PROMPT_PACKS[bundle["prompt_pack_index"]]
    kit = AUTOMATION_KITS[bundle["automation_kit_index"]]

    # High AOV bundle pricing
    price = round(random.choice([129.00, 179.00, 249.00, 299.00, 399.00]), 2)

    hook = random.choice(SECRET_HOOKS)
    niche = random.choice(NICHES)

    title = f"{bundle['title']} ({niche})"
    description = (
        f"{hook}. This is a paired bundle: one prompt pack + one automation kit that reinforce each other. "
        "Digital-only. Instant download. Scarcity-style offer copy included."
    )

    metrics = estimate_metrics("bundle", price)

    digital_content = (
        "BUNDLE CONTENTS:\n\n"
        f"1) PROMPT PACK: {prompt_pack['base_title']}\n"
        f"{prompt_pack['digital_content']}\n\n"
        f"2) AUTOMATION KIT: {kit['base_title']}\n"
        f"{kit['digital_content']}\n\n"
        "BONUS:\n"
        "- Limited-time scarcity copy pack\n"
        "- 'Secrets they don't want you to know' hook variants\n"
    )

    image_prompt = (
        "Premium bundle cover design, dark luxury tech theme, "
        "electric purple accent, 'Bundle' label, modern ecommerce hero image, "
        "clean typography, digital product packaging"
    )

    return {
        "title": title,
        "description": description,
        "productType": "bundle",
        "deliveryType": DELIVERY_TYPE,
        "price": price,
        "currency": CURRENCY,
        "tags": list(set(bundle["tags"] + [niche, "digital"])),
        "marketingHooks": [hook, "Bundle-only pricing", "Only chance to grab this combo"],
        "bundleComponents": [
            {"type": "prompt_pack", "title": prompt_pack["base_title"]},
            {"type": "automation_kit", "title": kit["base_title"]},
        ],
        "imagePrompt": image_prompt,
        "digitalContent": digital_content,
        **metrics,
    }


def generate_product():
    product_type = weighted_choice(PRODUCT_TYPE_WEIGHTS)
    if product_type == "bundle":
        return build_bundle()
    if product_type == "automation_kit":
        return build_automation_kit()
    return build_prompt_pack()


def main():
    print("=================================")
    print("         ORACLE (brain.py)       ")
    print("=================================")

    db = initialize_firebase()
    if db is None:
        raise SystemExit(1)

    product = generate_product()

    now = datetime.now(timezone.utc)
    product_doc = {
        **product,
        "status": "pending",
        "createdAt": now.isoformat(),
        "updatedAt": now.isoformat(),
        # Helpful for downstream state machines / debugging:
        "source": "oracle",
        "version": "2.0-digital-only-bundle-heavy",
    }

    doc_ref = db.collection(COLLECTION).document()
    doc_ref.set(product_doc)

    print(f"[Oracle] ✅ Created product {doc_ref.id}")
    print(f"[Oracle]    type={product_doc['productType']} price={product_doc['price']} status=pending")


if __name__ == "__main__":
    main()

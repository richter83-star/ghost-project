import os
import random
import string
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

import firebase_admin
from firebase_admin import credentials, firestore

# ============================================================
# ORACLE v2 — Digital-only + Bundle-first product idea generator
# Writes docs into Firestore collection: products (default)
# Status: pending
# Types: prompt_pack | automation_kit | bundle
# ============================================================

DEFAULT_COLLECTION = os.getenv("FIRESTORE_PRODUCTS_COLLECTION", "products")

# === Bundle bias (edit via env vars) ===
# Weights must sum to something > 0 (doesn't have to be 1.0)
W_PROMPT_PACK = float(os.getenv("ORACLE_WEIGHT_PROMPT_PACK", "0.25"))
W_AUTOMATION_KIT = float(os.getenv("ORACLE_WEIGHT_AUTOMATION_KIT", "0.25"))
W_BUNDLE = float(os.getenv("ORACLE_WEIGHT_BUNDLE", "0.50"))

# How many products to generate per run
PRODUCTS_PER_RUN = int(os.getenv("ORACLE_PRODUCTS_PER_RUN", "1"))

# When creating a bundle, try pulling recent components from the last N docs
RECENT_COMPONENT_LOOKBACK = int(os.getenv("ORACLE_COMPONENT_LOOKBACK", "50"))

# Make duplicates rarer
DEDUP_LOOKBACK_TITLES = int(os.getenv("ORACLE_DEDUP_LOOKBACK_TITLES", "100"))

# Optional hard theme override (for tight curation)
FORCED_THEME = os.getenv("ORACLE_FORCED_THEME", "").strip()


# ---------- Themes (digital only) ----------
THEMES = [
    {
        "theme": "Creator Growth",
        "audience": "content creators",
        "tag": "creator",
        "prompt_angles": ["hook writing", "thumbnail concepts", "story frameworks", "viral ideation"],
        "automation_angles": ["content calendar", "repurpose workflow", "lead capture", "newsletter engine"],
        "platforms": ["Notion", "Google Sheets", "n8n", "Zapier", "Make"],
    },
    {
        "theme": "E-commerce Scaling",
        "audience": "Shopify store owners",
        "tag": "ecom",
        "prompt_angles": ["product descriptions", "ad creatives", "UGC scripts", "email copy"],
        "automation_angles": ["abandoned cart", "post-purchase flows", "reviews engine", "support macros"],
        "platforms": ["Klaviyo", "Shopify", "Zapier", "n8n", "Make"],
    },
    {
        "theme": "Local Business Funnel",
        "audience": "local service businesses",
        "tag": "localbiz",
        "prompt_angles": ["review replies", "offer crafting", "IG captions", "lead qualification"],
        "automation_angles": ["booking followups", "review requests", "CRM intake", "missed-call recovery"],
        "platforms": ["Notion", "Zapier", "Make", "Google Sheets", "Twilio (concept)"],
    },
    {
        "theme": "Agency Ops",
        "audience": "small agencies",
        "tag": "agency",
        "prompt_angles": ["client proposals", "discovery questions", "audit scripts", "scope control"],
        "automation_angles": ["onboarding", "handoff checklists", "SOP generator", "client reporting"],
        "platforms": ["Notion", "Slack", "Zapier", "n8n", "Google Drive"],
    },
    {
        "theme": "Wellness & Coaching",
        "audience": "coaches and wellness brands",
        "tag": "wellness",
        "prompt_angles": ["guided scripts", "brand voice", "lesson plans", "challenge formats"],
        "automation_angles": ["intake forms", "session reminders", "content drip", "feedback loops"],
        "platforms": ["Notion", "Google Forms", "Zapier", "Make", "Email"],
    },
]

# ---------- Product templates ----------
PROMPT_PACK_COUNTS = [25, 50, 75, 100]
LIMITED_DROP_LINES = [
    "Limited-time drop",
    "Only chance to grab this combo",
    "Short-run bundle",
    "Limited drop — once it’s gone, it’s gone",
]
“SECRET_HOOKS” = [
    "Secrets they don't want you to know",
    "Playbook-level tactics",
    "Operator-grade templates",
]


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _rand_suffix(n: int = 5) -> str:
    return "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(n))


def _choose_theme() -> Dict[str, Any]:
    if FORCED_THEME:
        for t in THEMES:
            if t["theme"].lower() == FORCED_THEME.lower():
                return t
    return random.choice(THEMES)


def _weighted_choice() -> str:
    options = [
        ("prompt_pack", W_PROMPT_PACK),
        ("automation_kit", W_AUTOMATION_KIT),
        ("bundle", W_BUNDLE),
    ]
    total = sum(w for _, w in options)
    r = random.uniform(0, total)
    upto = 0.0
    for name, w in options:
        upto += w
        if upto >= r:
            return name
    return "bundle"


def _price_and_metrics(product_type: str) -> Dict[str, Any]:
    """
    Heuristic “decision support” fields (not guaranteed truth).
    You can replace later with real instrumentation.
    """
    if product_type == "prompt_pack":
        target = random.choice([19, 29, 39])
        shelf = [30, 120]
    elif product_type == "automation_kit":
        target = random.choice([49, 79, 99, 129])
        shelf = [60, 365]
    else:  # bundle
        target = random.choice([99, 149, 199, 249])
        shelf = [14, 45]

    # Digital goods: high gross margin (heuristic)
    margin = [85, 97]

    # “Popularity” proxy: time-on-shelf expectation in days (heuristic)
    # You’ll swap this later with real Shopify analytics.
    return {
        "pricing": {
            "currency": "USD",
            "target_price": target,
            "price_range": [max(9, int(target * 0.7)), int(target * 1.3)],
        },
        "decision_metrics": {
            "est_gross_margin_pct_range": margin,
            "est_shelf_life_days_range": shelf,
            "confidence": "low",  # until you wire real data
        },
    }


def _prompt_pack_doc(theme: Dict[str, Any]) -> Dict[str, Any]:
    angle = random.choice(theme["prompt_angles"])
    count = random.choice(PROMPT_PACK_COUNTS)
    title = f"{theme['theme']} Prompt Pack: {angle.title()} ({count} prompts)"
    hooks = [random.choice(LIMITED_DROP_LINES), random.choice(“SECRET_HOOKS”)]
    data = {
        "status": "pending",
        "productType": "prompt_pack",
        "digitalOnly": True,
        "title": title,
        "audience": theme["audience"],
        "theme": theme["theme"],
        "tags": [theme["tag"], "prompt_pack", "digital"],
        "hookLines": hooks,
        "summary": f"A curated pack of {count} prompts designed for {theme['audience']} focused on {angle}.",
        # Store the actual “digital payload” later in pipeline/metafields.
        "payloadHint": {
            "format": "text",
            "contents": f"PROMPT_PACK::{theme['tag']}::{angle}::{count}",
        },
        "createdAt": firestore.SERVER_TIMESTAMP,
        "createdAtIso": _utc_now_iso(),
        "createdBy": "oracle_v2",
        **_price_and_metrics("prompt_pack"),
    }
    return data


def _automation_kit_doc(theme: Dict[str, Any]) -> Dict[str, Any]:
    angle = random.choice(theme["automation_angles"])
    platform = random.choice(theme["platforms"])
    title = f"{theme['theme']} Automation Kit: {angle.title()} ({platform})"
    hooks = [random.choice(LIMITED_DROP_LINES)]
    data = {
        "status": "pending",
        "productType": "automation_kit",
        "digitalOnly": True,
        "title": title,
        "audience": theme["audience"],
        "theme": theme["theme"],
        "platform": platform,
        "tags": [theme["tag"], "automation_kit", "digital", platform.lower().replace(" ", "_")],
        "hookLines": hooks,
        "summary": f"A ready-to-deploy automation kit for {theme['audience']} to implement {angle} using {platform}.",
        "payloadHint": {
            "format": "templates",
            "contents": f"AUTOMATION_KIT::{theme['tag']}::{angle}::{platform}",
        },
        "createdAt": firestore.SERVER_TIMESTAMP,
        "createdAtIso": _utc_now_iso(),
        "createdBy": "oracle_v2",
        **_price_and_metrics("automation_kit"),
    }
    return data


def _get_recent_components(
    db: firestore.Client, theme_name: str
) -> Tuple[Optional[Tuple[str, Dict[str, Any]]], Optional[Tuple[str, Dict[str, Any]]]]:
    """
    Returns (prompt_pack, automation_kit) as (doc_id, doc_data) tuples, if found.
    """
    col = db.collection(DEFAULT_COLLECTION)
    recent = (
        col.where("theme", "==", theme_name)
        .order_by("createdAt", direction=firestore.Query.DESCENDING)
        .limit(RECENT_COMPONENT_LOOKBACK)
        .stream()
    )

    prompt = None
    auto = None
    for doc in recent:
        d = doc.to_dict() or {}
        pt = d.get("productType")
        if pt == "prompt_pack" and prompt is None:
            prompt = (doc.id, d)
        if pt == "automation_kit" and auto is None:
            auto = (doc.id, d)
        if prompt and auto:
            break

    return prompt, auto


def _bundle_doc(
    theme: Dict[str, Any],
    prompt_component: Tuple[str, Dict[str, Any]],
    auto_component: Tuple[str, Dict[str, Any]],
) -> Dict[str, Any]:
    title = f"LIMITED DROP: {theme['theme']} Growth Bundle (Prompts + Automations)"
    hooks = [
        random.choice(LIMITED_DROP_LINES),
        "Bundle deal — pay once, get both",
        random.choice(“SECRET_HOOKS”),
    ]
    data = {
        "status": "pending",
        "productType": "bundle",
        "digitalOnly": True,
        "title": title,
        "audience": theme["audience"],
        "theme": theme["theme"],
        "tags": [theme["tag"], "bundle", "digital", "premium"],
        "hookLines": hooks,
        "summary": (
            f"A premium bundle for {theme['audience']}: a prompt pack + an automation kit designed to work together."
        ),
        "bundle": {
            "includes": [
                {"refId": prompt_component[0], "productType": "prompt_pack", "title": prompt_component[1].get("title")},
                {"refId": auto_component[0], "productType": "automation_kit", "title": auto_component[1].get("title")},
            ],
            "positioning": "high_ticket_bundle",
        },
        "payloadHint": {
            "format": "bundle",
            "contents": f"BUNDLE::{theme['tag']}::{prompt_component[0]}+{auto_component[0]}",
        },
        "createdAt": firestore.SERVER_TIMESTAMP,
        "createdAtIso": _utc_now_iso(),
        "createdBy": "oracle_v2",
        **_price_and_metrics("bundle"),
    }
    return data


def _recent_titles(db: firestore.Client) -> List[str]:
    col = db.collection(DEFAULT_COLLECTION)
    docs = (
        col.order_by("createdAt", direction=firestore.Query.DESCENDING)
        .limit(DEDUP_LOOKBACK_TITLES)
        .stream()
    )
    titles = []
    for doc in docs:
        d = doc.to_dict() or {}
        t = d.get("title")
        if isinstance(t, str):
            titles.append(t.strip().lower())
    return titles


def _ensure_unique_title(doc: Dict[str, Any], recent_titles: List[str]) -> Dict[str, Any]:
    t = (doc.get("title") or "").strip()
    if not t:
        doc["title"] = f"Untitled Digital Product {_rand_suffix()}"
        return doc

    if t.lower() in recent_titles:
        doc["title"] = f"{t} — v{_rand_suffix(4)}"
    return doc


def init_firestore() -> firestore.Client:
    """
    Uses a Render Secret File PATH by default.
    Set: FIREBASE_SERVICE_ACCOUNT_PATH=/etc/secrets/<yourfile>
    Alternatively you can inject JSON via FIREBASE_SERVICE_ACCOUNT_JSON (not recommended).
    """
    if firebase_admin._apps:
        return firestore.client()

    sa_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "").strip()
    sa_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()

    if sa_json:
        import json
        cred = credentials.Certificate(json.loads(sa_json))
        firebase_admin.initialize_app(cred)
        return firestore.client()

    if not sa_path:
        raise RuntimeError("Missing FIREBASE_SERVICE_ACCOUNT_PATH (recommended) or FIREBASE_SERVICE_ACCOUNT_JSON.")

    cred = credentials.Certificate(sa_path)
    firebase_admin.initialize_app(cred)
    return firestore.client()


def create_products_once():
    db = init_firestore()
    col = db.collection(DEFAULT_COLLECTION)

    recent_titles = _recent_titles(db)

    for _ in range(PRODUCTS_PER_RUN):
        theme = _choose_theme()
        product_type = _weighted_choice()

        # If bundle: try to reuse recent components; if missing, generate them first.
        if product_type == "bundle":
            prompt, auto = _get_recent_components(db, theme["theme"])
            if not prompt:
                prompt_doc = _ensure_unique_title(_prompt_pack_doc(theme), recent_titles)
                p_ref = col.document()
                p_ref.set(prompt_doc)
                prompt = (p_ref.id, prompt_doc)
                recent_titles.append(prompt_doc["title"].strip().lower())

            if not auto:
                auto_doc = _ensure_unique_title(_automation_kit_doc(theme), recent_titles)
                a_ref = col.document()
                a_ref.set(auto_doc)
                auto = (a_ref.id, auto_doc)
                recent_titles.append(auto_doc["title"].strip().lower())

            bundle_doc = _ensure_unique_title(_bundle_doc(theme, prompt, auto), recent_titles)
            b_ref = col.document()
            b_ref.set(bundle_doc)
            print(f"[Oracle] ✅ created BUNDLE: {b_ref.id} | {bundle_doc['title']}")
            continue

        if product_type == "prompt_pack":
            doc = _ensure_unique_title(_prompt_pack_doc(theme), recent_titles)
        else:
            doc = _ensure_unique_title(_automation_kit_doc(theme), recent_titles)

        ref = col.document()
        ref.set(doc)
        print(f"[Oracle] ✅ created {doc['productType'].upper()}: {ref.id} | {doc['title']}")


if __name__ == "__main__":
    print("=================================")
    print("   ORACLE v2 (Digital + Bundles) ")
    print("=================================")
    print(f"[Oracle] Collection: {DEFAULT_COLLECTION}")
    print(f"[Oracle] Per run: {PRODUCTS_PER_RUN}")
    print(f"[Oracle] Weights: prompt_pack={W_PROMPT_PACK} automation_kit={W_AUTOMATION_KIT} bundle={W_BUNDLE}")
    create_products_once()

# Curation Controls - Summary

## Your Concern

**"Will this generate too many items and not make it feel curated or special?"**

## Solution: Curation Controls ✅

I've added comprehensive curation controls to ensure your store feels curated, special, and premium rather than automated.

## Quick Answer

**Default Settings** (Current):
- Max **3 products per day**
- Only **70%+ confidence** products
- **Duplicate detection** enabled
- Feels curated, not spammy

**Strict Settings** (Recommended for Premium Feel):
- Max **1 product per day** 
- Only **85%+ confidence** products
- **Manual review required**
- Very curated, hand-picked feel

## Configuration Options

### Option 1: Strict (Very Curated)
```env
ADAPTIVE_AI_CURATION_LEVEL=strict
ADAPTIVE_AI_GENERATION_INTERVAL_HOURS=48
```

**Result**: 1 premium product every 2 days, requires your approval

### Option 2: Default (Balanced)
```env
ADAPTIVE_AI_CURATION_LEVEL=default
```

**Result**: 1-3 high-quality products daily, auto-published

### Option 3: Custom (Your Choice)
```env
ADAPTIVE_AI_MIN_CONFIDENCE=0.8
ADAPTIVE_AI_MAX_PRODUCTS_PER_DAY=2
ADAPTIVE_AI_REQUIRE_MANUAL_REVIEW=true
```

## What's Protected

✅ **Duplicate Prevention** - Blocks similar products (70%+ similarity)
✅ **Daily Limits** - Won't generate more than configured per day
✅ **Confidence Thresholds** - Only high-quality predictions
✅ **Niche Limits** - Balanced distribution across niches
✅ **Manual Review** - Optional approval before publishing

## Recommendation

For a **curated, special feel**, use:

```env
ADAPTIVE_AI_CURATION_LEVEL=strict
ADAPTIVE_AI_GENERATION_INTERVAL_HOURS=48
```

This gives you:
- 🎯 1 premium product every 2 days
- 🔒 Requires your approval
- ✨ Feels hand-picked, not automated
- 📈 High quality only (85%+ confidence)

## Full Documentation

See `CURATION_CONTROLS.md` for complete details.


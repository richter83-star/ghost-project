# Adaptive AI Curation Controls

## Overview

The Adaptive AI system includes **curation controls** to ensure your store feels curated, special, and unique rather than automated or spammy.

## Curation Levels

### 🎯 Default (Balanced)
**Configuration**: `ADAPTIVE_AI_CURATION_LEVEL=default` (or unset)

- **Min Confidence**: 70% (only high-confidence products)
- **Duplicate Check**: Enabled (blocks 70%+ similar products)
- **Daily Limit**: 3 products per day
- **Niche Limit**: 50 products per niche
- **Manual Review**: Disabled (auto-publish)

**Best for**: Most stores - balanced between curation and automation

### 🔒 Strict (Very Selective)
**Configuration**: `ADAPTIVE_AI_CURATION_LEVEL=strict`

- **Min Confidence**: 85% (only very high-confidence products)
- **Duplicate Check**: Enabled (blocks 60%+ similar products)
- **Daily Limit**: 1 product per day
- **Niche Limit**: 25 products per niche
- **Manual Review**: **Enabled** (requires approval before publishing)

**Best for**: Premium stores that want a very curated, hand-picked feel

### 📈 Relaxed (More Products)
**Configuration**: `ADAPTIVE_AI_CURATION_LEVEL=relaxed`

- **Min Confidence**: 50% (medium confidence)
- **Duplicate Check**: Enabled (blocks 85%+ similar products)
- **Daily Limit**: 10 products per day
- **Niche Limit**: 100 products per niche
- **Manual Review**: Disabled (auto-publish)

**Best for**: Stores that want more inventory and faster growth

## Configuration

### Environment Variables

Add to your Render dashboard or `.env` file:

```env
# Curation level: strict, default, or relaxed
ADAPTIVE_AI_CURATION_LEVEL=default

# Override specific settings (optional)
ADAPTIVE_AI_MIN_CONFIDENCE=0.7
ADAPTIVE_AI_MAX_PRODUCTS_PER_DAY=3
ADAPTIVE_AI_MAX_PRODUCTS_PER_NICHE=50
ADAPTIVE_AI_CHECK_DUPLICATES=true
ADAPTIVE_AI_REQUIRE_MANUAL_REVIEW=false
```

### Recommended Settings for Curated Feel

```env
ADAPTIVE_AI_CURATION_LEVEL=strict
ADAPTIVE_AI_GENERATION_INTERVAL_HOURS=48  # Every 2 days instead of daily
ADAPTIVE_AI_MIN_PRODUCTS=1
ADAPTIVE_AI_MAX_PRODUCTS=1
```

This will:
- ✅ Generate only 1 high-quality product every 2 days
- ✅ Require manual review before publishing
- ✅ Block duplicates aggressively
- ✅ Feel very curated and special

## How It Works

### 1. Confidence Filtering
Only products with confidence scores above the threshold are generated. Higher confidence = better market fit predictions.

### 2. Duplicate Detection
Compares new products to existing ones:
- Checks title similarity (word-based matching)
- Blocks products that are 70%+ similar (configurable)
- Prevents duplicate spam

### 3. Daily Limits
Prevents over-generation:
- Tracks products created today
- Stops when daily limit is reached
- Resets at midnight

### 4. Niche Limits
Maintains balance across niches:
- Limits total products per niche
- Prevents one niche from dominating
- Keeps catalog diverse

### 5. Manual Review Mode
When enabled:
- Products created with `status: "pending_review"`
- Won't automatically publish
- Requires manual approval in Firestore

## Manual Review Workflow

If you enable `ADAPTIVE_AI_REQUIRE_MANUAL_REVIEW=true`:

1. **Products are created** with `status: "pending_review"`
2. **Review in Firestore** or your admin panel
3. **Approve** by changing status to `"pending"` (will auto-process)
4. **Reject** by deleting or archiving the product

## Examples

### Example 1: Premium Curated Store
```env
ADAPTIVE_AI_CURATION_LEVEL=strict
ADAPTIVE_AI_GENERATION_INTERVAL_HOURS=48
ADAPTIVE_AI_REQUIRE_MANUAL_REVIEW=true
```

**Result**: 1 carefully selected product every 2 days, requires your approval

### Example 2: Balanced Automation
```env
ADAPTIVE_AI_CURATION_LEVEL=default
ADAPTIVE_AI_GENERATION_INTERVAL_HOURS=24
```

**Result**: 1-3 high-quality products daily, auto-published

### Example 3: High-Growth Store
```env
ADAPTIVE_AI_CURATION_LEVEL=relaxed
ADAPTIVE_AI_GENERATION_INTERVAL_HOURS=12
```

**Result**: Up to 10 products daily, faster growth

## Monitoring

Check your logs to see curation in action:

```
[AdaptiveAI] 🎨 Curation mode: strict
[AdaptiveAI] 🎨 Min confidence: 85%, Max per day: 1
[AdaptiveAI] ⏭️ Skipping product: Confidence 72% below minimum 85%
[AdaptiveAI] ⏭️ Skipping duplicate product: Too similar to existing product...
[AdaptiveAI] ✅ Created product: "... (needs review)"
```

## Tips for Maximum Curation

1. **Use Strict Mode**: Highest quality filter
2. **Enable Manual Review**: Review before publishing
3. **Increase Interval**: Generate less frequently (48-72 hours)
4. **Monitor Daily**: Check products before they auto-publish
5. **Archive Underperformers**: Remove products that don't sell

## Custom Rules

You can customize rules in code by modifying `src/lib/adaptive-ai/curation.ts`:

```typescript
export function getCustomCurationRules(): CurationRules {
  return {
    minConfidence: 0.8, // 80% confidence
    checkDuplicates: true,
    maxSimilarityPercent: 65, // Block 65%+ similar
    requireManualReview: true,
    maxProductsPerDay: 2,
    maxProductsPerNiche: 30,
    minDaysBetweenSimilar: 10,
  };
}
```

## Summary

The curation system ensures:
- ✅ **Quality over quantity** - Only high-confidence products
- ✅ **Uniqueness** - No duplicates or near-duplicates
- ✅ **Balance** - Limits prevent over-generation
- ✅ **Control** - Optional manual review for premium feel

Choose the curation level that matches your brand!


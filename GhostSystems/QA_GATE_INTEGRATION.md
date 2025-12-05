# QA Gate Integration Guide

## Overview

The Product QA Gate has been integrated into Ghost/Fleet to enforce quality standards before products reach Shopify. This acts as a "quality firewall" preventing placeholder inventory from being published.

## What Changed

### 1. QA Gate System Added

- **Location**: `GhostSystems/qa-gate/`
- **Purpose**: Evaluates products and assigns QA scores (0-100)
- **Output**: Writes QA results to Firestore `qa` field

### 2. Shopify Pipeline Updated

**File**: `GhostSystems/src/integrations/shopify-pipeline.ts`

**Change**: Now only processes products with `status == "qa_passed"`

```typescript
// Before:
const query = productsRef.where('status', '==', 'draft');

// After:
const query = productsRef.where('status', '==', 'qa_passed');
```

## Workflow

```
1. Product Created → status: "pending"
2. Nexus Listener → status: "draft"
3. QA Gate → Evaluates product
   ├─ Pass (score ≥ 80, no fails) → status: "qa_passed"
   └─ Fail → status: "qa_failed"
4. Shopify Pipeline → Only processes "qa_passed" products
```

## Setup

### 1. Install QA Gate Dependencies

```bash
cd GhostSystems/qa-gate
npm install
```

### 2. Configure Environment Variables

Create `.env` file or set in Render:

```env
# Required
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# Optional (defaults shown)
QA_SCAN_STATUSES=pending,draft
QA_WRITE_STATUS=true
QA_PASSED_STATUS=qa_passed
QA_FAILED_STATUS=qa_failed
QA_BATCH_LIMIT=25
QA_SCAN_CRON=*/15 * * * *
```

### 3. Deploy QA Gate

**Option A: Render Worker (Recommended)**

1. Create new Worker service in Render
2. Root directory: `GhostSystems/qa-gate`
3. Build: `npm install`
4. Start: `npm start`
5. Add environment variables

**Option B: Run Locally**

```bash
cd GhostSystems/qa-gate
npm run dev
```

## Testing

### Test Single Product

```bash
# If HTTP enabled
curl -X POST http://localhost:8089/qa/one/PRODUCT_ID

# Or use Firestore directly
# QA Gate will pick it up on next sweep
```

### Manual Sweep

```bash
# If HTTP enabled
curl -X POST http://localhost:8089/qa/sweep
```

## QA Criteria

Products must meet these standards to pass:

- ✅ Title ≥ 12 characters (not placeholder)
- ✅ Description ≥ 200 characters
- ✅ Contains "what's inside" language
- ✅ No banned marketing claims
- ✅ Valid cover image (not placeholder)
- ✅ Artifact present and ≥ 5KB
- ✅ ZIP files include README (if required)
- ✅ Prompt count matches (if detectable)
- ✅ Valid price > 0
- ✅ No duplicate concepts (unless grouped)

**Passing**: Score ≥ 80 with no fail reasons

## Monitoring

### Check QA Results in Firestore

```javascript
// Products that passed QA
db.collection('products')
  .where('status', '==', 'qa_passed')
  .get()

// Products that failed QA
db.collection('products')
  .where('status', '==', 'qa_failed')
  .get()

// View QA details
const product = await db.collection('products').doc(id).get();
const qa = product.data().qa;
console.log('Score:', qa.score);
console.log('Fail reasons:', qa.fail_reasons);
```

### Common Fail Reasons

- `title_too_short`: Title < 12 characters
- `description_too_short`: Description < 200 characters
- `artifact_missing`: No artifact_path or artifact_url
- `artifact_too_small`: Artifact < 5KB
- `cover_missing_or_placeholder`: Invalid cover image
- `banned_claims`: Contains prohibited marketing language
- `duplicate_concept_without_variants`: Duplicate without grouping

## Disabling QA Gate (Not Recommended)

If you need to temporarily bypass QA:

1. **Option 1**: Change Shopify pipeline query back to `'draft'`
2. **Option 2**: Set `QA_WRITE_STATUS=false` (QA runs but doesn't change status)
3. **Option 3**: Manually set products to `qa_passed` in Firestore

**Warning**: This defeats the purpose of the quality firewall. Only do this for testing.

## Troubleshooting

### Products Stuck in "draft"

- Check QA Gate is running
- Verify `QA_SCAN_STATUSES` includes `draft`
- Check Firestore for `qa` field - if missing, QA hasn't run
- Review logs for errors

### Products Failing QA

- Check `qa.fail_reasons` in Firestore
- Fix issues (add artifact, improve description, etc.)
- Re-run QA (it will re-check on next sweep)

### QA Gate Not Running

- Verify Firebase credentials
- Check `QA_SCAN_CRON` schedule
- Review logs for startup errors
- Ensure service has Firestore read/write permissions

## Next Steps

1. ✅ QA Gate integrated
2. ✅ Shopify pipeline updated
3. ⏳ Deploy QA Gate to Render
4. ⏳ Monitor QA results
5. ⏳ Adjust QA criteria as needed

## Files Added

- `GhostSystems/qa-gate/` - Complete QA Gate system
- `GhostSystems/qa-gate/README.md` - QA Gate documentation
- `GhostSystems/QA_GATE_INTEGRATION.md` - This file

## Files Modified

- `GhostSystems/src/integrations/shopify-pipeline.ts` - Updated to only process `qa_passed` products


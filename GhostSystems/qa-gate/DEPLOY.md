# QA Gate Deployment Guide

## Quick Deploy to Render

### Step 1: Create Worker Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Background Worker"**
3. Connect your GitHub repository
4. Configure the service:

   **Name**: `qa-gate` (or `ghost-qa-gate`)
   
   **Root Directory**: `GhostSystems/qa-gate`
   
   **Environment**: `Node`
   
   **Build Command**: `npm install`
   
   **Start Command**: `npm start`
   
   **Plan**: Free (or Starter/Pro if you need more resources)

### Step 2: Set Environment Variables

In Render dashboard → Environment tab, add:

#### Required
```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

#### Optional (with defaults)
```
FIRESTORE_JOBS_COLLECTION=products
QA_SCAN_STATUSES=pending,draft
QA_WRITE_STATUS=true
QA_PASSED_STATUS=qa_passed
QA_FAILED_STATUS=qa_failed
QA_BATCH_LIMIT=25
QA_SCAN_CRON=*/15 * * * *
QA_MIN_ARTIFACT_BYTES=5000
QA_REQUIRE_README_IN_ZIP=true
QA_HTTP_ENABLED=false
QA_HTTP_PORT=8089
```

### Step 3: Deploy

1. Click **"Create Background Worker"**
2. Render will build and deploy automatically
3. Check **Logs** tab to verify it's running

### Step 4: Verify

1. Check logs for: `"QA Gate starting"`
2. Wait for first sweep (runs on boot)
3. Check Firestore for products with `qa` field
4. Verify products are getting `qa_passed` or `qa_failed` status

## Local Development

### Setup

```bash
cd GhostSystems/qa-gate
npm install
cp .env.example .env
# Edit .env with your credentials
```

### Run

```bash
# Development mode (with hot reload)
npm run dev

# Production build
npm run build
npm start
```

### Test Single Product

If HTTP is enabled:
```bash
curl -X POST http://localhost:8089/qa/one/PRODUCT_ID
```

Or manually set a product to `draft` status and wait for next sweep.

## Monitoring

### Check QA Results in Firestore

```javascript
// Products that passed
db.collection('products')
  .where('status', '==', 'qa_passed')
  .get()

// Products that failed
db.collection('products')
  .where('status', '==', 'qa_failed')
  .get()

// View QA details
const product = await db.collection('products').doc(id).get();
const qa = product.data().qa;
console.log('Score:', qa.score);
console.log('Fail reasons:', qa.fail_reasons);
```

### Render Logs

Check Render dashboard → Logs tab for:
- `"QA sweep starting"`
- `"QA evaluated"` (for each product)
- `"QA sweep done"` (with processed count)
- Any errors

## Troubleshooting

### Service Won't Start

- **Check Firebase credentials**: Verify `FIREBASE_SERVICE_ACCOUNT_JSON` is valid JSON
- **Check project ID**: Verify `FIREBASE_PROJECT_ID` matches your Firebase project
- **Check logs**: Look for initialization errors

### Products Not Being Evaluated

- **Check statuses**: Verify products have `status: "pending"` or `"draft"`
- **Check scan statuses**: Verify `QA_SCAN_STATUSES` includes your product statuses
- **Check batch limit**: Increase `QA_BATCH_LIMIT` if you have many products
- **Check cron schedule**: Verify `QA_SCAN_CRON` is running (default: every 15 min)

### Products Failing QA

- **Check fail reasons**: Look at `qa.fail_reasons` in Firestore
- **Common issues**:
  - `title_too_short`: Title < 12 characters
  - `description_too_short`: Description < 200 characters
  - `artifact_missing`: No artifact_path or artifact_url
  - `cover_missing_or_placeholder`: Invalid cover image
  - `banned_claims`: Contains prohibited marketing language

### Duplicate Detection False Positives

- Use `product_group_id` or `variant_of` fields to group variants
- Products with these fields won't fail on duplicates

## Configuration Tips

### Faster Scanning

```env
QA_BATCH_LIMIT=50          # Process more per sweep
QA_SCAN_CRON=*/5 * * * *  # Run every 5 minutes
```

### Stricter QA

```env
QA_MIN_ARTIFACT_BYTES=10000      # Require larger artifacts
QA_REQUIRE_README_IN_ZIP=true    # Require README in ZIPs
```

### Enable HTTP API

```env
QA_HTTP_ENABLED=true
QA_HTTP_PORT=8089
```

Then you can manually trigger:
```bash
curl -X POST https://your-service.onrender.com/qa/sweep
```

## Next Steps

1. ✅ Deploy QA Gate to Render
2. ✅ Monitor first sweep
3. ✅ Verify products are being evaluated
4. ✅ Check Shopify pipeline is processing `qa_passed` products
5. ✅ Adjust QA criteria as needed

## Support

- Check `qa-gate/README.md` for detailed documentation
- Check `QA_GATE_INTEGRATION.md` for integration details
- Check `QA_GATE_VERIFICATION.md` for verification checklist


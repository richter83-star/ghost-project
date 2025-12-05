# QA Gate Quick Start

## ✅ Deployment Complete Checklist

After deploying to Render, verify these steps:

### 1. Check Service Status
- [ ] Service shows "Live" in Render dashboard
- [ ] No crash errors in logs
- [ ] Service is running continuously

### 2. Verify Configuration
Run the test script to verify environment variables:

```bash
# On Render (via Shell)
cd GhostSystems/qa-gate
npm run test:config

# Or locally
npm run qa:test
```

Expected output:
```
✅ FIREBASE_PROJECT_ID: your-project-id
✅ FIREBASE_SERVICE_ACCOUNT_JSON: Valid JSON
   Project ID in JSON: your-project-id
   Client Email: firebase-adminsdk-...
```

### 3. Check Logs for Startup
Look for these messages in Render logs:

```
QA Gate starting
QA sweep starting
QA evaluated (for each product)
QA sweep done
```

### 4. Verify Firestore Updates
Check that products are getting QA results:

```javascript
// In Firestore console or via code
const product = await db.collection('products').doc('PRODUCT_ID').get();
const qa = product.data().qa;

// Should see:
// qa.status: "passed" or "failed"
// qa.score: 0-100
// qa.fail_reasons: []
// qa.checked_at: timestamp
// qa.concept_key: normalized key
```

### 5. Verify Status Updates
Check that product statuses are being updated:

```javascript
// Products that passed QA
db.collection('products')
  .where('status', '==', 'qa_passed')
  .get()

// Products that failed QA
db.collection('products')
  .where('status', '==', 'qa_failed')
  .get()
```

### 6. Verify Shopify Pipeline Integration
- [ ] Shopify pipeline is running
- [ ] Only `qa_passed` products are being processed
- [ ] Products are being published to Shopify

## Troubleshooting

### Service Won't Start
1. Check environment variables are set correctly
2. Run `npm run test:config` to verify configuration
3. Check Render logs for specific errors

### Products Not Being Evaluated
1. Verify products have `status: "pending"` or `"draft"`
2. Check `QA_SCAN_STATUSES` matches your product statuses
3. Wait for next cron run (default: every 15 minutes)
4. Check logs for "QA sweep starting"

### Products Failing QA
1. Check `qa.fail_reasons` in Firestore
2. Common issues:
   - `title_too_short`: Title < 12 characters
   - `description_too_short`: Description < 200 characters
   - `artifact_missing`: No artifact_path or artifact_url
   - `cover_missing_or_placeholder`: Invalid cover image

### Manual Trigger (if HTTP enabled)
If you enabled HTTP API:

```bash
# Trigger manual sweep
curl -X POST https://your-service.onrender.com/qa/sweep

# Evaluate single product
curl -X POST https://your-service.onrender.com/qa/one/PRODUCT_ID
```

## Success Indicators

✅ **QA Gate is working if:**
- Service is running without errors
- Logs show "QA sweep starting" and "QA sweep done"
- Products in Firestore have `qa` field
- Products are getting `qa_passed` or `qa_failed` status
- Shopify pipeline is processing `qa_passed` products

## Next Steps After Verification

1. ✅ Monitor QA results for a few hours
2. ✅ Adjust QA criteria if needed (via environment variables)
3. ✅ Review products that fail QA and fix issues
4. ✅ Verify Shopify store only shows quality products

## Support

- Full documentation: `qa-gate/README.md`
- Environment setup: `qa-gate/ENV_SETUP.md`
- Deployment guide: `qa-gate/DEPLOY.md`
- Integration guide: `QA_GATE_INTEGRATION.md`


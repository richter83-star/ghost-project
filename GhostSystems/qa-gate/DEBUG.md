# QA Gate Debugging Guide

## Current Status from Logs

✅ **Service is running correctly:**
- Build successful
- TypeScript compiled
- Service started
- QA sweeps are running every 15 minutes

⚠️ **But processing 0 products:**
- This means no products match the query criteria

## Why 0 Products?

The QA Gate is looking for products with:
- `status == "pending"` OR `status == "draft"`
- In the collection specified by `FIRESTORE_JOBS_COLLECTION` (default: "products")

### Possible Reasons:

1. **No products with those statuses**
   - Products might already be `qa_passed`, `qa_failed`, `published`, etc.
   - Check your Firestore to see what statuses your products have

2. **Products already checked recently**
   - QA Gate skips products checked in the last hour
   - Check `qa.checked_at` field in Firestore

3. **Wrong collection name**
   - Verify `FIRESTORE_JOBS_COLLECTION` matches your actual collection
   - Default is "products"

4. **Products don't exist yet**
   - No products in Firestore with those statuses

## How to Verify

### 1. Check Firestore Products

```javascript
// Check what statuses your products have
db.collection('products')
  .get()
  .then(snap => {
    const statuses = {};
    snap.docs.forEach(doc => {
      const status = doc.data().status;
      statuses[status] = (statuses[status] || 0) + 1;
    });
    console.log('Product statuses:', statuses);
  });
```

### 2. Check QA Field

```javascript
// Check if products have qa field
db.collection('products')
  .limit(10)
  .get()
  .then(snap => {
    snap.docs.forEach(doc => {
      const data = doc.data();
      console.log(doc.id, {
        status: data.status,
        hasQa: !!data.qa,
        qaStatus: data.qa?.status,
        qaScore: data.qa?.score
      });
    });
  });
```

### 3. Manually Trigger QA (if HTTP enabled)

If you set `QA_HTTP_ENABLED=true`, you can trigger manually:

```bash
# Trigger sweep
curl -X POST https://your-service.onrender.com/qa/sweep

# Evaluate specific product
curl -X POST https://your-service.onrender.com/qa/one/PRODUCT_ID
```

### 4. Create Test Product

To test QA Gate, create a product with `status: "draft"`:

```javascript
await db.collection('products').add({
  title: "Test Product for QA",
  description: "This is a test product to verify QA Gate is working correctly. It has a long enough description to pass QA checks.",
  status: "draft",
  price: 9.99,
  product_type: "AI Prompt Pack",
  prompt_count: 10,
  artifact_url: "https://example.com/test.zip"
});
```

## Expected Behavior

### When Products Are Found:

```
QA sweep starting
QA evaluated { id: '...', status: 'passed', score: 85, ... }
QA evaluated { id: '...', status: 'failed', score: 65, ... }
QA sweep done { processed: 2 }
```

### When No Products Match:

```
QA sweep starting
QA sweep done { processed: 0 }
```

## Troubleshooting Steps

### Step 1: Verify Products Exist

Check Firestore for products with `status: "pending"` or `"draft"`:

```javascript
// Count products by status
const pending = await db.collection('products')
  .where('status', '==', 'pending')
  .count()
  .get();

const draft = await db.collection('products')
  .where('status', '==', 'draft')
  .count()
  .get();

console.log('Pending:', pending.data().count);
console.log('Draft:', draft.data().count);
```

### Step 2: Check Collection Name

Verify `FIRESTORE_JOBS_COLLECTION` matches your actual collection:

```javascript
// List all collections (if you have access)
// Or check your Shopify pipeline config
```

### Step 3: Check Throttling

Products checked in the last hour are skipped. Check `qa.checked_at`:

```javascript
const product = await db.collection('products').doc('ID').get();
const qa = product.data().qa;
if (qa?.checked_at) {
  const checked = new Date(qa.checked_at);
  const hoursAgo = (Date.now() - checked.getTime()) / (1000 * 60 * 60);
  console.log(`Checked ${hoursAgo.toFixed(2)} hours ago`);
}
```

### Step 4: Enable HTTP API for Manual Testing

In Render, set:
```
QA_HTTP_ENABLED=true
```

Then you can manually trigger:
```bash
curl -X POST https://your-service.onrender.com/qa/sweep
```

## Next Steps

1. ✅ QA Gate is running correctly
2. ⏳ Check Firestore for products with `pending` or `draft` status
3. ⏳ If no products, create test products or wait for new ones
4. ⏳ If products exist, check why they're not being picked up
5. ⏳ Verify collection name matches

## Success Indicators

You'll know it's working when you see:
- `processed: > 0` in logs
- Products in Firestore have `qa` field
- Products getting `qa_passed` or `qa_failed` status


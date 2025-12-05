# QA Gate Environment Variables Setup

## Required Variables

### 1. FIREBASE_PROJECT_ID

**What it is**: Your Firebase project ID

**Where to find it**:
- Firebase Console → Project Settings → General tab
- Or in your Firebase project URL: `https://console.firebase.google.com/project/YOUR_PROJECT_ID`

**Example**:
```
FIREBASE_PROJECT_ID=ghost-project-12345
```

---

### 2. FIREBASE_SERVICE_ACCOUNT_JSON

**What it is**: Complete Firebase service account JSON as a single string

**Where to get it**:
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Project Settings** (gear icon)
4. Click **Service Accounts** tab
5. Click **Generate New Private Key**
6. Download the JSON file
7. Copy the entire JSON content

**Format**: The entire JSON object as a single-line string (or multi-line in Render)

**Example**:
```json
{
  "type": "service_account",
  "project_id": "ghost-project-12345",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@ghost-project-12345.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

**In Render**: Paste the entire JSON as a single value (Render handles multi-line JSON)

**Alternative**: If you prefer using a file path instead:
```
FIREBASE_SERVICE_ACCOUNT_PATH=/etc/secrets/firebase-service-account.json
```

---

## Optional Variables (with defaults)

### FIRESTORE_JOBS_COLLECTION

**Default**: `products`

**What it is**: The Firestore collection name where your products are stored

**Example**:
```
FIRESTORE_JOBS_COLLECTION=products
```

**Note**: Must match the collection name used by your Shopify pipeline

---

### QA_SCAN_STATUSES

**Default**: `pending,draft`

**What it is**: Comma-separated list of product statuses to scan for QA

**Example**:
```
QA_SCAN_STATUSES=pending,draft
```

**Other options**:
```
QA_SCAN_STATUSES=draft
QA_SCAN_STATUSES=pending,draft,review
```

---

### QA_WRITE_STATUS

**Default**: `true`

**What it is**: Whether to update product status after QA evaluation

**Options**:
```
QA_WRITE_STATUS=true   # Update status to qa_passed/qa_failed
QA_WRITE_STATUS=false   # Only write qa field, don't change status
```

---

### QA_PASSED_STATUS

**Default**: `qa_passed`

**What it is**: Status to set when product passes QA

**Example**:
```
QA_PASSED_STATUS=qa_passed
```

**Note**: This must match what your Shopify pipeline listens for

---

### QA_FAILED_STATUS

**Default**: `qa_failed`

**What it is**: Status to set when product fails QA

**Example**:
```
QA_FAILED_STATUS=qa_failed
```

---

### QA_BATCH_LIMIT

**Default**: `25`

**What it is**: Maximum number of products to process per sweep

**Example**:
```
QA_BATCH_LIMIT=25
QA_BATCH_LIMIT=50   # Process more per sweep
```

---

### QA_SCAN_CRON

**Default**: `*/15 * * * *` (every 15 minutes)

**What it is**: Cron schedule for automatic QA sweeps

**Examples**:
```
QA_SCAN_CRON=*/15 * * * *    # Every 15 minutes
QA_SCAN_CRON=*/5 * * * *     # Every 5 minutes
QA_SCAN_CRON=0 * * * *       # Every hour
QA_SCAN_CRON=0 */6 * * *     # Every 6 hours
```

**Cron format**: `minute hour day month weekday`

---

### QA_MIN_ARTIFACT_BYTES

**Default**: `5000` (5KB)

**What it is**: Minimum artifact file size in bytes

**Example**:
```
QA_MIN_ARTIFACT_BYTES=5000
QA_MIN_ARTIFACT_BYTES=10000   # Require 10KB minimum
```

---

### QA_REQUIRE_README_IN_ZIP

**Default**: `true`

**What it is**: Whether to require README file in ZIP artifacts

**Options**:
```
QA_REQUIRE_README_IN_ZIP=true   # Require README
QA_REQUIRE_README_IN_ZIP=false  # Don't require README
```

---

### QA_HTTP_ENABLED

**Default**: `false`

**What it is**: Enable HTTP API for manual triggers

**Options**:
```
QA_HTTP_ENABLED=false   # No HTTP API (default)
QA_HTTP_ENABLED=true    # Enable HTTP API on QA_HTTP_PORT
```

---

### QA_HTTP_PORT

**Default**: `8089`

**What it is**: Port for HTTP API (only used if QA_HTTP_ENABLED=true)

**Example**:
```
QA_HTTP_PORT=8089
```

---

## Complete Example for Render

Here's a complete example of all variables you might set in Render:

### Required (must set)
```
FIREBASE_PROJECT_ID=ghost-project-12345
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"ghost-project-12345",...}
```

### Recommended (set to match your setup)
```
FIRESTORE_JOBS_COLLECTION=products
QA_PASSED_STATUS=qa_passed
QA_FAILED_STATUS=qa_failed
```

### Optional (use defaults or customize)
```
QA_SCAN_STATUSES=pending,draft
QA_WRITE_STATUS=true
QA_BATCH_LIMIT=25
QA_SCAN_CRON=*/15 * * * *
QA_MIN_ARTIFACT_BYTES=5000
QA_REQUIRE_README_IN_ZIP=true
QA_HTTP_ENABLED=false
QA_HTTP_PORT=8089
```

---

## Local Development (.env file)

Create `GhostSystems/qa-gate/.env`:

```env
# Required
FIREBASE_PROJECT_ID=ghost-project-12345
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"ghost-project-12345","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-xxxxx@ghost-project-12345.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}

# Optional (with defaults)
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

**Note**: For local `.env`, you can put the JSON on multiple lines or as a single line.

---

## Quick Setup Checklist

- [ ] Get Firebase Project ID from Firebase Console
- [ ] Generate Firebase Service Account JSON key
- [ ] Copy entire JSON content
- [ ] Set `FIREBASE_PROJECT_ID` in Render/local env
- [ ] Set `FIREBASE_SERVICE_ACCOUNT_JSON` in Render/local env
- [ ] (Optional) Set `FIRESTORE_JOBS_COLLECTION` if different from "products"
- [ ] (Optional) Customize other QA settings as needed

---

## Security Notes

⚠️ **Never commit**:
- `FIREBASE_SERVICE_ACCOUNT_JSON` to git
- `.env` files to git
- Service account keys to version control

✅ **Safe to commit**:
- `.env.example` (without real values)
- `render.yaml` (with `sync: false` for secrets)

---

## Troubleshooting

### "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON"
- Make sure you copied the entire JSON object
- Check for missing quotes or brackets
- In Render, paste as a single value (Render handles multi-line)

### "Provide FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH"
- Make sure at least one of these is set
- Check variable name spelling (case-sensitive)

### "FIREBASE_PROJECT_ID environment variable is not set"
- Make sure variable is set in Render/local env
- Check variable name spelling


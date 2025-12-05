# Product QA Gate

A quality assurance system that evaluates products before they become `ready_for_shopify`. This acts as a "quality firewall" to prevent placeholder inventory from reaching your Shopify store.

## Features

- **Deterministic Scoring**: 0-100 score based on comprehensive rubric
- **Hard Checks**: Blocks products with critical issues (missing artifacts, banned claims, etc.)
- **Duplicate Detection**: Identifies duplicate concepts and prevents them from being published
- **Artifact Validation**: Checks ZIP files for README, validates prompt counts, verifies file sizes
- **Compliance Checks**: Detects banned marketing claims (guaranteed profits, risk-free, etc.)
- **Firestore Integration**: Writes QA results directly to product documents

## Quick Start

### Local Development

```bash
cd qa-gate
cp .env.example .env
# Edit .env with your Firebase credentials
npm install
npm run dev
```

### Production (Render)

1. Create a new **Worker** service in Render
2. Set root directory to `GhostSystems/qa-gate`
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variables (see Configuration)

## Configuration

### Required

- `FIREBASE_PROJECT_ID`: Your Firebase project ID
- `FIREBASE_SERVICE_ACCOUNT_JSON`: Firebase service account JSON (as string) OR
- `FIREBASE_SERVICE_ACCOUNT_PATH`: Path to service account JSON file

### Optional Behavior

- `QA_SCAN_STATUSES`: Comma-separated statuses to scan (default: `pending,draft`)
- `QA_WRITE_STATUS`: Whether to update product status (default: `true`)
- `QA_PASSED_STATUS`: Status to set when QA passes (default: `qa_passed`)
- `QA_FAILED_STATUS`: Status to set when QA fails (default: `qa_failed`)

### Batch Scanning

- `QA_BATCH_LIMIT`: Max products per sweep (default: `25`)
- `QA_SCAN_CRON`: Cron schedule (default: `*/15 * * * *` = every 15 minutes)

### Artifact Checks

- `QA_MIN_ARTIFACT_BYTES`: Minimum artifact size (default: `5000`)
- `QA_REQUIRE_README_IN_ZIP`: Require README in ZIP files (default: `true`)

### HTTP Server

- `QA_HTTP_ENABLED`: Enable HTTP API (default: `false`)
- `QA_HTTP_PORT`: HTTP server port (default: `8089`)

## QA Rubric

Products are scored 0-100 based on:

### Offer Clarity (-20 to -40 points)
- Title too short (< 12 chars): -20
- Placeholder title: -40
- Description too short (< 200 chars): -20

### Storefront Trust (-5 to -10 points)
- Missing "what's inside" language: -10
- Missing setup/instructions: -5

### Compliance (-40 points)
- Banned marketing claims: -40

### Asset Quality (-25 points)
- Missing or placeholder cover image: -25

### Deliverable Integrity (-20 to -50 points)
- Missing artifact: -50
- Artifact too small: -20
- Missing README in ZIP: -20

### Content Integrity (-30 points)
- Prompt count mismatch: -30

### Pricing (-25 points)
- Invalid price (≤ 0): -25

### Duplicate Detection (-25 points)
- Duplicate concept without variants: -25

**Passing Score**: ≥ 80 with no fail reasons

## Integration with Shopify Pipeline

The Shopify pipeline has been updated to only process products with:
- `status == "qa_passed"` OR
- `qa.status == "passed"`

This ensures QA is a hard gate before products reach Shopify.

## API Endpoints (if HTTP enabled)

- `GET /health`: Health check
- `POST /qa/one/:id`: Evaluate a single product by ID
- `POST /qa/sweep`: Run a manual QA sweep

## Workflow

1. Products start as `pending` or `draft`
2. QA Gate scans these statuses (configurable)
3. Products are evaluated and scored
4. QA results written to `qa` field in Firestore
5. Status updated to `qa_passed` or `qa_failed` (if enabled)
6. Shopify pipeline only processes `qa_passed` products

## QA Result Structure

```typescript
{
  qa: {
    status: "passed" | "failed",
    score: 0-100,
    fail_reasons: string[],
    concept_key: string,  // normalized for duplicate detection
    checked_at: string,   // ISO timestamp
    duplicates: Array<{ id, title, price, status }>
  }
}
```

## Troubleshooting

### Products Not Being Evaluated

- Check `QA_SCAN_STATUSES` matches your product statuses
- Verify Firebase credentials are correct
- Check logs for errors

### Products Failing QA

- Review `qa.fail_reasons` in Firestore
- Check artifact paths/URLs are accessible
- Verify titles/descriptions meet minimum requirements

### Duplicate Detection False Positives

- Use `product_group_id` or `variant_of` fields to group variants
- Products with these fields won't fail on duplicates

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## License

Part of the Ghost/Fleet system.


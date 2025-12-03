# How to Run the Fix Script

## Quick Answer

Since your credentials are in Render, you have two options:

### Option 1: Run on Render (Easiest - Recommended)

1. Go to: https://dashboard.render.com
2. Click your **ghostsystems** service
3. Click **Shell** tab
4. Run:
   ```bash
   cd GhostSystems
   npm run fix:shopify
   ```

All credentials are already there!

### Option 2: Add Credentials Locally

Add to `GhostSystems/.env` file:

```env
SHOPIFY_STORE_URL=dracanus-ai.myshopify.com
SHOPIFY_ADMIN_API_TOKEN=your_token_from_render
GEMINI_API_KEY=your_key_from_render
```

Then run:
```bash
npm run fix:shopify
```

## Get Credentials from Render

1. Go to Render dashboard → Your service
2. Click **Environment** tab
3. Copy:
   - `SHOPIFY_STORE_URL` value
   - `SHOPIFY_ADMIN_API_TOKEN` value  
   - `GEMINI_API_KEY` value (if needed)

## What Will Happen

The script will:
- ✅ Fix inventory on all products
- ✅ Add placeholder images
- ✅ Generate AI descriptions (using your Gemini key)

**Recommended: Run on Render Shell** - everything is already configured there!


# Run Fix Script on Render

Since your credentials are already in Render, you can run the fix script directly on Render's server.

## Option 1: Render Shell (Recommended)

1. Go to your Render dashboard: https://dashboard.render.com
2. Click on your `ghostsystems` service
3. Click on **Shell** tab (or **Logs** → **Shell**)
4. Run:
   ```bash
   cd GhostSystems
   npm run fix:shopify
   ```

This will use all the environment variables already set in Render.

## Option 2: Add to Local .env File

If you want to run locally, add to `GhostSystems/.env`:

```env
SHOPIFY_STORE_URL=dracanus-ai.myshopify.com
SHOPIFY_ADMIN_API_TOKEN=your_token_here
GEMINI_API_KEY=your_key_here
```

You can get these from your Render dashboard → Environment tab.

## What the Script Will Do

1. ✅ Fix inventory on all products (make them available)
2. ✅ Add placeholder images to products missing images  
3. ✅ Generate AI descriptions for products with poor descriptions

## Recommended: Run on Render

Since all your credentials are already there, running on Render is easiest:
- All environment variables are already set
- No need to copy credentials locally
- Runs in the same environment as your production service


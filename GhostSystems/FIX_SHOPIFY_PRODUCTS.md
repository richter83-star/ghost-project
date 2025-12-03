# Fix Shopify Products Guide

## Problems Identified

1. **Products showing "Sold Out"** - Inventory tracking is enabled
2. **Missing/Poor Descriptions** - Need better description generation
3. **Missing Images** - No product images

## Quick Fix

### Step 1: Fix Inventory (Makes products available)

Run the fix script:

```bash
npm run fix:shopify
```

This will:
- Remove inventory tracking from all variants
- Make products available for purchase (not "sold out")
- Show which products need descriptions/images

### Step 2: Enable Description Generation

Make sure `GEMINI_API_KEY` is set in your environment. New products will automatically generate better descriptions.

### Step 3: Add Images (Optional)

Images are currently optional. You can:
1. Enable automatic image generation (requires Gemini/Imagen API)
2. Add images manually in Shopify
3. Use placeholder images

## What Changed

### Inventory Fix
- **Before**: `inventory_management: 'shopify'`, `inventory_policy: 'deny'`, `inventory_quantity: 0`
- **After**: `inventory_management: null`, `inventory_policy: 'continue'`
- **Result**: Products are available for purchase (unlimited stock for digital products)

### Description Improvements
- **Better prompts** for Gemini AI
- **Minimum 150 words** (was 20 characters)
- **More detailed, persuasive** descriptions

### Future Products
All new products will:
- ✅ Be available immediately (no inventory tracking)
- ✅ Have detailed descriptions (auto-generated)
- ✅ Include images (when generation is enabled)

## Manual Steps

### Fix Existing Products in Shopify

1. Go to Shopify Admin → Products
2. For each product:
   - Click on the product
   - Go to "Inventory" section
   - Set "Track quantity" to **OFF**
   - Set "Continue selling when out of stock" to **ON**
3. Save

Or use the script above to fix all products at once.

## Testing

After running the fix:
1. Check a product page - should show "Add to cart" (not "Sold out")
2. Verify description length and quality
3. Add placeholder images if needed

## Next Steps

1. ✅ Run `npm run fix:shopify` to fix existing products
2. ✅ Set `GEMINI_API_KEY` for better descriptions on new products
3. ⚠️ Consider adding image generation or placeholder images


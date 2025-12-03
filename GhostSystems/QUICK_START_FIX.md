# Quick Start - Fix Your Shopify Store Now 🚀

## What's Ready

✅ All code is deployed to Render  
✅ Fix script is ready to run  
✅ Gemini API key is configured  

## Run It Now (2 Steps)

### Step 1: Open Render Shell
1. Go to: https://dashboard.render.com
2. Click your **ghostsystems** service
3. Click **"Shell"** tab (or **Logs** → **Shell**)

### Step 2: Run the Script
```bash
cd GhostSystems
npm run fix:shopify
```

That's it! 🎉

## What Happens

The script will automatically:
- ✅ Fix inventory (make products available, not "sold out")
- ✅ Add placeholder images to products missing images
- ✅ Generate AI descriptions for products with poor descriptions

## Expected Output

```
🔧 Fixing Shopify Products...

📦 Found 25 products to check

📦 Product Name (ID: xyz)
  ✅ Fixed inventory for variant abc
  ✅ Generated and updated description (250 chars)
  ✅ Added placeholder image

📊 Summary:
  ✅ Fixed inventory: 25 variants
  ✅ Added images: 10 products
  ✅ Improved descriptions: 15 products

✅ Done! Your products should now:
   - Show as available (not "sold out")
   - Have placeholder images
   - Have detailed, AI-generated descriptions
```

## After Running

Check your Shopify store - everything should be fixed! 🎊

---

**That's all you need to do!** Just open Render shell and run those two commands.


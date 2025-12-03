# Run Fix Script on Render - Step by Step

## Quick Steps

1. **Go to Render Dashboard**
   - Open: https://dashboard.render.com
   - Sign in if needed

2. **Open Your Service**
   - Click on your **ghostsystems** service (or the service name you're using)

3. **Open Shell**
   - Look for a **"Shell"** tab/button in the service dashboard
   - OR go to **"Logs"** tab and look for **"Shell"** option
   - OR use the **"Connect via SSH"** option if available

4. **Run the Fix Script**
   Once you have a shell/terminal open, run:
   ```bash
   cd GhostSystems
   npm run fix:shopify
   ```

5. **Watch It Work!**
   - The script will process all your products
   - You'll see progress for each product
   - It will fix inventory, add images, and improve descriptions

## What You'll See

```
🔧 Fixing Shopify Products...

📦 Found X products to check

📦 Product Name (ID: xyz)
  ✅ Fixed inventory for variant abc
  ✅ Generated and updated description (250 chars)
  ✅ Added placeholder image

📊 Summary:
  ✅ Fixed inventory: X variants (products now available)
  ✅ Added images: X products (placeholder images)
  ✅ Improved descriptions: X products (AI-generated)

✅ Done!
```

## Troubleshooting

### Can't Find Shell Tab?
- Some Render services show it in **"Logs"** → **"Shell"**
- Or use **"SSH"** connection option
- Or check the service settings for terminal access

### Script Not Found?
- Make sure you're in the `GhostSystems` directory
- Run: `cd GhostSystems && npm run fix:shopify`

### Need Help?
- Check Render logs for any errors
- Verify your Shopify credentials are set in Render environment variables
- Make sure the service has deployed the latest code

## After It Runs

Your products will have:
- ✅ Fixed inventory (available, not sold out)
- ✅ Placeholder images
- ✅ AI-generated descriptions (if Gemini key is set)

Then check your Shopify store - everything should look much better! 🎉


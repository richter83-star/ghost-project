# Adaptive AI Sales Data Integration

## Overview

Adaptive AI learns from sales performance across multiple platforms to generate better products. This document explains how to configure and verify sales data integration.

## Required Configuration

### Shopify (Primary Platform)
- **SHOPIFY_STORE_URL**: Your Shopify store URL (e.g., `dracanus-ai.myshopify.com`)
- **SHOPIFY_ADMIN_API_TOKEN**: Shopify Admin API token with read access to orders

**Status**: ✅ Already configured in `render.yaml`

### Optional Platforms

#### Gumroad
- **GUMROAD_API_KEY**: Gumroad API key for sales data
- **Status**: ✅ Already configured in `render.yaml` (optional)

#### Lemon Squeezy
- **LEMONSQUEEZY_API_KEY**: Lemon Squeezy API key
- **LEMONSQUEEZY_STORE_ID**: Your Lemon Squeezy store ID
- **Status**: ✅ Already configured in `render.yaml` (optional)

## How Sales Data is Used

1. **Market Analysis**: Analyzes sales from last 90 days across all platforms
2. **Product Performance**: Tracks revenue, conversion rates, and trends
3. **Niche Performance**: Identifies which niches sell best
4. **Price Optimization**: Determines optimal price ranges per product type
5. **Strategy Generation**: Creates data-driven product generation strategies

## Verification

### Check Sales Data Collection

Run the analysis command:
```bash
npm run adaptive-ai:analyze
```

This will show:
- Number of products analyzed
- Sales data sources (Shopify, Gumroad, Lemon)
- Top performing products and niches
- Optimal price ranges

### Expected Output

If sales data is working:
```
[AdaptiveAI] ✅ Analyzed 50 products
[AdaptiveAI] 📊 Sales data sources: shopify (120 orders), gumroad (45 sales)
[AdaptiveAI] 🎯 Top performing niche: creators (36 products, $2,450 revenue)
```

If sales data is missing:
```
[AdaptiveAI] ⚠️ No sales data found, using fallback strategies
[AdaptiveAI] 📊 Generated 3 products with default confidence (50%)
```

## Fallback Behavior

If sales data is not available:
- System uses fallback strategies with 50% confidence
- Still generates products, but without market insights
- Products are created with default price ranges
- System will learn once sales data becomes available

## Troubleshooting

### "Failed to fetch Shopify orders"
- Verify `SHOPIFY_STORE_URL` and `SHOPIFY_ADMIN_API_TOKEN` are set correctly
- Check that the API token has read access to orders
- Verify the store URL doesn't include `https://` prefix

### "Missing API key, skipping sync" (Gumroad/Lemon)
- This is expected if you're not using these platforms
- Only Shopify is required for basic functionality
- Gumroad and Lemon are optional for multi-platform analysis

### No sales data showing
- Ensure you have at least 10-20 products with sales
- Sales must be from the last 90 days to be included
- Check that products have proper `niche` and `product_type` fields

## Next Steps

Once sales data is integrated:
1. Run `npm run adaptive-ai:analyze` to verify data collection
2. Wait for Adaptive AI to generate products based on insights
3. Monitor product performance to see learning in action
4. Review generated products - they should align with top performers


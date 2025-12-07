# Oracle to Adaptive AI Migration Guide

## Overview

This guide helps you migrate from Oracle (static product generator) to Adaptive AI (learning product generator). Adaptive AI learns from sales data and continuously improves, making it superior to Oracle's static template-based approach.

## Migration Checklist

### Phase 1: Verify Adaptive AI is Working

1. **Check Adaptive AI Status**:
   ```bash
   # Check if Adaptive AI is enabled
   curl https://your-app-url.onrender.com/api/adaptive-ai/status
   ```

2. **Test Product Generation**:
   ```bash
   npm run adaptive-ai:generate 3
   ```

3. **Verify Products in Firestore**:
   - Check for products with `source: "adaptive_ai"`
   - Verify they have proper descriptions and metadata
   - Ensure they're being processed by the pipeline

### Phase 2: Compare Performance

1. **Run Comparison Script**:
   ```bash
   npm run compare:oracle-vs-adaptive
   ```

2. **Review Metrics**:
   - Product generation rate
   - Description quality
   - Sales performance (if available)
   - Market alignment

### Phase 3: Stop Oracle

#### Option A: If Oracle runs on Render
1. Go to Render dashboard
2. Find the Oracle worker service
3. Pause or delete the service

#### Option B: If Oracle runs on cron
1. Find cron job: `crontab -l`
2. Remove Oracle cron entries
3. Verify: `crontab -l` (should not show Oracle)

#### Option C: If Oracle runs manually
1. Stop any running `python Oracle/brain.py` processes
2. Remove any startup scripts that launch Oracle

### Phase 4: Monitor Transition

1. **Watch for Adaptive AI Products**:
   - Check Firestore for new `adaptive_ai` products
   - Verify they're being published to Shopify
   - Monitor sales performance

2. **Check Logs**:
   - Look for `[AdaptiveAI]` log entries
   - Verify generation cycles are running
   - Check for any errors

3. **Review Analytics**:
   ```bash
   npm run adaptive-ai:analyze
   ```

## Key Differences

| Feature | Oracle | Adaptive AI |
|---------|--------|-------------|
| **Generation** | Random templates | Data-driven strategies |
| **Pricing** | Fixed ranges | Optimized based on performance |
| **Learning** | None | Continuous from sales data |
| **Market Awareness** | None | Full market analysis |
| **Performance Prediction** | None | Expected metrics included |
| **Adaptability** | Static | Continuously improves |

## Product Identification

Both systems create products with `status: "pending"`, so they follow the same workflow:

```
pending → Nexus Listener → draft → Shopify Pipeline → published
```

Products are tagged with their source:
- Oracle: `source: "oracle"`
- Adaptive AI: `source: "adaptive_ai"`

### Filter Products in Firestore

```javascript
// Oracle products
db.collection('products').where('source', '==', 'oracle')

// Adaptive AI products
db.collection('products').where('source', '==', 'adaptive_ai')
```

## Rollback Plan

If you need to revert to Oracle:

1. **Re-enable Oracle**:
   - Restore Oracle service/script
   - Set `ENABLE_ADAPTIVE_AI=false` (or remove from env)

2. **Keep Adaptive AI Products**:
   - Existing Adaptive AI products will continue to work
   - They're just regular products in your store
   - No need to delete them

## Data Requirements

Adaptive AI needs sales data to learn. Minimum requirements:

- **At least 10-20 products with sales** (to identify patterns)
- **Sales from last 90 days** (for trend analysis)
- **Product metadata** (niche, product_type, tags)

If you don't have enough data yet:
1. Keep Oracle running temporarily
2. Or manually create some products
3. Once you have sales, Adaptive AI will start learning

## Performance Expectations

### Initial Phase (First 1-2 weeks)
- Adaptive AI may be conservative (fewer products)
- Learning from limited data
- Similar to Oracle in output

### Learning Phase (2-4 weeks)
- Starts identifying patterns
- Generates more targeted products
- Better pricing optimization

### Optimized Phase (4+ weeks)
- Full market awareness
- High-confidence strategies
- Predictable performance metrics

## Troubleshooting

### "No products generated"
- **Check**: Run `npm run adaptive-ai:analyze` - do you see recommendations?
- **Check**: Do you have sales data? (at least 10-20 products with sales)
- **Solution**: Wait for more sales data, or manually create some products to seed the market

### "Failed to fetch Shopify orders"
- **Check**: Shopify credentials are set correctly
- **Solution**: Verify `SHOPIFY_STORE_URL` and `SHOPIFY_ADMIN_API_TOKEN`

### Products not performing well
- **Check**: Run analysis to see what's working
- **Solution**: Adaptive AI will learn and adjust - give it time to gather data

## Support

For issues or questions:
1. Check `ADAPTIVE_AI.md` for detailed documentation
2. Review logs: `npm run adaptive-ai:analyze`
3. Check Firestore for generated products
4. Monitor Adaptive AI status: `/api/adaptive-ai/status`

## Archive Oracle Code

Once migration is complete and verified:

1. **Keep Oracle code for reference** (don't delete yet)
2. **Document what Oracle did** (for historical reference)
3. **Mark Oracle as deprecated** in code comments
4. **After 30 days of successful Adaptive AI operation**, consider archiving Oracle folder

---

**Status**: Ready for migration. Follow the checklist above to complete the transition.


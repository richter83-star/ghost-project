# Migrating from Oracle to Adaptive AI

## Quick Start

### 1. Test Adaptive AI (Recommended First)

```bash
# Analyze your current market
npm run adaptive-ai:analyze

# Generate a few test products
npm run adaptive-ai:generate 3
```

### 2. Enable in Production

Add to your `.env` or Render environment variables:

```env
ENABLE_ADAPTIVE_AI=true
ADAPTIVE_AI_GENERATION_INTERVAL_HOURS=24
ADAPTIVE_AI_MIN_PRODUCTS=3
ADAPTIVE_AI_MAX_PRODUCTS=5
```

### 3. Stop Oracle (Once Adaptive AI is Proven)

If Oracle is running on a schedule (cron, Render worker, etc.), disable it:

- **Render**: Delete or pause the Oracle worker service
- **Cron**: Remove Oracle cron jobs
- **Manual**: Stop running `python Oracle/brain.py`

## Key Differences

### Oracle (Old System)
- **Generation**: Random selection from templates
- **Pricing**: Fixed price ranges per product type
- **Learning**: None - static templates
- **Market Awareness**: None
- **Performance**: No prediction

### Adaptive AI (New System)
- **Generation**: Data-driven strategies based on sales
- **Pricing**: Optimized based on actual performance
- **Learning**: Continuous from sales data
- **Market Awareness**: Full market analysis
- **Performance**: Expected metrics included

## Product Flow

Both systems create products with `status: "pending"`, so they follow the same workflow:

```
pending → Nexus Listener → draft → Shopify Pipeline → published
```

## Product Identification

Products are tagged with their source:

- Oracle: `source: "oracle"`
- Adaptive AI: `source: "adaptive_ai"`

You can filter in Firestore:
```javascript
// Oracle products
db.collection('products').where('source', '==', 'oracle')

// Adaptive AI products
db.collection('products').where('source', '==', 'adaptive_ai')
```

## Monitoring

### Check Generated Products

```bash
# In Firestore console or via code
db.collection('products')
  .where('source', '==', 'adaptive_ai')
  .orderBy('createdAt', 'desc')
  .limit(10)
```

### Monitor Performance

```bash
npm run adaptive-ai:analyze
```

This shows:
- How Adaptive AI products are performing
- Market insights
- Recommendations

## Rollback Plan

If you need to revert to Oracle:

1. Set `ENABLE_ADAPTIVE_AI=false` (or remove from env)
2. Restart your service
3. Re-enable Oracle if needed

**Note**: Existing Adaptive AI products will continue to work - they're just regular products in your store.

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

**Check**:
1. Run `npm run adaptive-ai:analyze` - do you see recommendations?
2. Do you have sales data? (at least 10-20 products with sales)
3. Are products properly tagged with `niche` and `product_type`?

**Solution**: Wait for more sales data, or manually create some products to seed the market.

### "Failed to fetch Shopify orders"

**Check**: Shopify credentials are set correctly

**Solution**: Verify `SHOPIFY_STORE_URL` and `SHOPIFY_ADMIN_API_TOKEN`

### Products not performing well

**Check**: Run analysis to see what's working

**Solution**: Adaptive AI will learn and adjust - give it time to gather data

## Support

For issues or questions:
1. Check `ADAPTIVE_AI.md` for detailed documentation
2. Review logs: `npm run adaptive-ai:analyze`
3. Check Firestore for generated products


# Adaptive AI - AI-Generated Descriptions

## Overview

Adaptive AI uses Gemini AI to generate high-quality, persuasive product descriptions instead of using static templates. This results in better SEO, higher conversion rates, and more engaging product copy.

## Configuration

### Required Environment Variable

- **GEMINI_API_KEY**: Your Google Gemini API key
- **Status**: ✅ Already configured in `render.yaml`

### How It Works

1. **Product Generation**: When Adaptive AI generates a product, it first creates a template description
2. **AI Enhancement**: If `GEMINI_API_KEY` is set, it calls Gemini to generate an enhanced description
3. **Fallback**: If AI generation fails or API key is missing, it uses the template description

## Code Implementation

The description generation happens in `src/lib/adaptive-ai/generator.ts`:

```typescript
// Generate AI-enhanced description if Gemini is available
try {
  const aiDescription = await generateDescription(title, strategy.productType);
  if (aiDescription) {
    description = aiDescription;
  }
} catch (error) {
  console.warn('[AdaptiveAI] Failed to generate AI description, using template:', error);
}
```

## Description Quality

AI-generated descriptions:
- **Length**: 150+ words (4-6 sentences)
- **SEO-Friendly**: Includes relevant keywords naturally
- **Persuasive**: Highlights benefits and creates value perception
- **Professional**: Clear, professional tone that sells effectively
- **Customized**: Tailored to product title and type

## Verification

### Check if AI Descriptions are Working

1. **Generate a test product**:
   ```bash
   npm run adaptive-ai:generate 1
   ```

2. **Check the product in Firestore**:
   - Look for products with `source: "adaptive_ai"`
   - Check the `description` field
   - AI-generated descriptions will be 150+ words and more detailed than templates

3. **Check logs**:
   - Success: `[AdaptiveAI] ✅ Generated product with AI description`
   - Fallback: `[AdaptiveAI] ⚠️ Failed to generate AI description, using template`

### Expected Output

**AI-Generated Description** (150+ words):
```
Transform your digital product visuals with this premium prompt pack designed specifically for creators. This comprehensive collection includes 75 carefully crafted prompts that help you generate stunning, sellable images using Midjourney, DALL·E, and SDXL. Each prompt has been optimized for consistency, style control, and commercial appeal. Whether you're creating product covers, social media graphics, or marketing materials, these prompts give you the tools to produce professional-quality visuals that convert. The pack includes style guides, negative prompts, composition recipes, and bonus variants to help you achieve the exact look you need. Perfect for content creators, digital marketers, and entrepreneurs who want to elevate their visual branding without hiring a designer.
```

**Template Description** (shorter, less detailed):
```
A premium prompt pack for creators. Includes variations, negative prompts, and composition controls to generate consistent, sellable images.
```

## Troubleshooting

### "GEMINI_API_KEY environment variable is not set"
- **Solution**: Add `GEMINI_API_KEY` to your environment variables
- **Location**: `render.yaml` or `.env` file
- **Note**: System will fall back to template descriptions if not set

### "Failed to generate description"
- **Check**: Verify your Gemini API key is valid
- **Check**: Ensure you have API quota available
- **Fallback**: System automatically uses template descriptions

### Descriptions are still short/template-like
- **Check**: Verify `GEMINI_API_KEY` is set correctly
- **Check**: Look for error messages in logs
- **Check**: Ensure the API key has proper permissions

## Benefits

1. **Better SEO**: AI-generated descriptions include relevant keywords naturally
2. **Higher Conversion**: More persuasive copy that highlights benefits
3. **Consistency**: All products get high-quality descriptions automatically
4. **Scalability**: No manual writing required for each product
5. **Adaptability**: Descriptions are tailored to each product type and niche

## Next Steps

Once AI descriptions are enabled:
1. Generate a few test products to verify quality
2. Compare AI-generated vs template descriptions
3. Monitor conversion rates to measure impact
4. Adjust prompts in `src/lib/gemini.ts` if needed for your brand voice


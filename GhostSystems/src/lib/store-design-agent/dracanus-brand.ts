/**
 * DRACANUS AI Brand Profile
 * Pre-configured brand identity based on official brand assets
 */

import { BrandProfile } from './brand-analyzer.js';

/**
 * Get the official DRACANUS AI brand profile
 * This is pre-configured based on the brand assets provided
 */
export function getDracanusBrandProfile(): BrandProfile {
  return {
    logoUrl: null, // Will be fetched from Shopify if available
    colors: {
      primary: '#1a1a1a',        // Dark charcoal (dragon body)
      secondary: '#2d2d2d',      // Medium dark gray (background)
      accent: '#ffffff',         // Bright white (dragon eye, highlights)
      background: '#0d0d0d',     // Near black (deepest background)
    },
    style: {
      aesthetic: 'tech',         // Tech-forward, futuristic
      mood: 'innovative',        // Powerful, intelligent, cutting-edge
      industry: 'AI / digital goods',
    },
    typography: {
      recommended: ['Inter', 'SF Pro Display', 'Segoe UI', 'Roboto'],
      style: 'modern sans-serif with tech feel',
    },
    designGuidelines: {
      doThis: [
        'Use dark backgrounds (#0d0d0d to #1a1a1a)',
        'Add metallic silver accents (#e0e0e0 to #ffffff)',
        'Incorporate circuit board patterns subtly',
        'Use sharp, angular design elements (minimal border radius)',
        'High contrast between dark and light elements',
        'Glowing white accents for important elements',
        'Dragon motif as subtle watermark or accent',
        'Geometric, precise layouts',
      ],
      avoidThis: [
        'Bright colors or pastels',
        'Rounded, playful designs',
        'Light backgrounds',
        'Cluttered layouts',
        'Generic stock photos',
        'Warm color tones',
        'Excessive gradients',
      ],
    },
    rawAnalysis: `DRACANUS AI Brand Identity:
- Dark, metallic, tech-forward aesthetic
- Dragon + circuit board fusion design
- Deep charcoal grays (#1a1a1a) with bright white accents (#ffffff)
- Sharp, angular geometric elements
- High contrast, premium feel
- Suitable for AI/digital products`,
    analyzedAt: new Date(),
  };
}

/**
 * Get DRACANUS-specific product image prompt
 * Optimized for generating images that match the brand
 */
export function getDracanusImagePrompt(productTitle: string, productType: string): string {
  return `Create a product image for "${productTitle}" (${productType}).

Style Requirements (DRACANUS AI Brand):
- Dark background: deep charcoal gray (#1a1a1a) or near black (#0d0d0d)
- Metallic silver accents: bright white (#ffffff) highlights
- Tech-forward aesthetic: subtle circuit board patterns, geometric elements
- Sharp, angular design: minimal curves, precise lines
- High contrast: dark base with glowing white accents
- Premium feel: sleek, sophisticated, powerful

The image should feel like it belongs to a dark, metallic, AI-powered brand.
Avoid bright colors, rounded designs, or playful elements.
Focus on: dark, tech, metallic, angular, premium.`;
}

/**
 * Get DRACANUS color palette for theme settings
 */
export function getDracanusColors() {
  return {
    background: '#0d0d0d',
    surface: '#1a1a1a',
    text: '#e8e8e8',
    textSecondary: '#b8b8bc',
    accent: '#ffffff',
    border: '#2a2a2e',
    metallic: '#4a4a4f',
  };
}


/**
 * Store Design Agent - Brand Analyzer
 * 
 * Analyzes store logo and branding to generate brand-aligned recommendations.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { getShopInfo } from '../shopify.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface BrandProfile {
  logoUrl: string | null;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
  };
  style: {
    aesthetic: string;      // e.g., "modern", "minimal", "bold", "elegant", "tech", "playful"
    mood: string;           // e.g., "professional", "friendly", "luxurious", "energetic"
    industry: string;       // e.g., "tech", "fashion", "digital goods", "AI/automation"
  };
  typography: {
    recommended: string[];  // Font suggestions that match the brand
    style: string;          // e.g., "sans-serif modern", "elegant serif", "bold display"
  };
  designGuidelines: {
    doThis: string[];       // Design recommendations
    avoidThis: string[];    // Things to avoid
  };
  rawAnalysis: string;      // Full AI analysis for reference
  analyzedAt: Date;
}

/**
 * Fetch the store's logo URL from Shopify
 */
export async function fetchStoreLogo(): Promise<string | null> {
  try {
    const shop = await getShopInfo();
    
    // Shopify stores logo in different places
    // Check for custom logo first, then favicon
    if (shop?.logo?.src) {
      return shop.logo.src;
    }
    
    // Try to get from theme settings or shop info
    // The logo might be in shop.primary_logo or shop.logo
    if (shop?.primary_logo?.src) {
      return shop.primary_logo.src;
    }

    console.log('[BrandAnalyzer] No logo found in shop info');
    return null;
  } catch (error: any) {
    console.error('[BrandAnalyzer] Failed to fetch logo:', error.message);
    return null;
  }
}

/**
 * Download image and convert to base64 for Gemini Vision
 */
async function imageUrlToBase64(url: string): Promise<string | null> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 30000,
    });
    const base64 = Buffer.from(response.data).toString('base64');
    return base64;
  } catch (error: any) {
    console.error('[BrandAnalyzer] Failed to download image:', error.message);
    return null;
  }
}

/**
 * Analyze a logo using Gemini Vision AI
 */
export async function analyzeLogo(logoUrl: string): Promise<BrandProfile | null> {
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[BrandAnalyzer] GEMINI_API_KEY not set');
    return null;
  }

  console.log('[BrandAnalyzer] 🎨 Analyzing logo:', logoUrl.substring(0, 50) + '...');

  try {
    // Download and convert image to base64
    const imageBase64 = await imageUrlToBase64(logoUrl);
    if (!imageBase64) {
      console.error('[BrandAnalyzer] Could not download logo image');
      return null;
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `You are a brand design expert. Analyze this logo and provide a comprehensive brand profile.

Analyze the logo and provide:

1. **Colors** - Extract the main colors used:
   - Primary color (main brand color)
   - Secondary color
   - Accent color (if any, or suggest one that complements)
   - Recommended background color

2. **Style Analysis**:
   - Aesthetic (choose one: modern, minimal, bold, elegant, tech, playful, vintage, corporate, artistic)
   - Mood (choose one: professional, friendly, luxurious, energetic, calm, innovative, trustworthy)
   - Industry it suggests (e.g., tech, AI, digital goods, automation, software)

3. **Typography Recommendations**:
   - List 3-5 Google Fonts that would match this brand
   - Typography style description

4. **Design Guidelines**:
   - 5 things a designer SHOULD do to match this brand
   - 5 things a designer should AVOID

Respond in JSON format:
{
  "colors": {
    "primary": "#hexcode",
    "secondary": "#hexcode", 
    "accent": "#hexcode",
    "background": "#hexcode"
  },
  "style": {
    "aesthetic": "string",
    "mood": "string",
    "industry": "string"
  },
  "typography": {
    "recommended": ["Font1", "Font2", "Font3"],
    "style": "description"
  },
  "designGuidelines": {
    "doThis": ["tip1", "tip2", "tip3", "tip4", "tip5"],
    "avoidThis": ["avoid1", "avoid2", "avoid3", "avoid4", "avoid5"]
  },
  "summary": "A 2-3 sentence summary of the brand identity"
}`;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/png',
          data: imageBase64,
        },
      },
      { text: prompt },
    ]);

    const response = result.response.text();
    
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[BrandAnalyzer] Could not parse AI response');
      return null;
    }

    const analysis = JSON.parse(jsonMatch[0]);

    const brandProfile: BrandProfile = {
      logoUrl,
      colors: analysis.colors || {
        primary: '#1e1e2e',
        secondary: '#312e81',
        accent: '#8b5cf6',
        background: '#0f0f1a',
      },
      style: analysis.style || {
        aesthetic: 'modern',
        mood: 'innovative',
        industry: 'digital goods',
      },
      typography: analysis.typography || {
        recommended: ['Inter', 'Space Grotesk', 'JetBrains Mono'],
        style: 'modern sans-serif',
      },
      designGuidelines: analysis.designGuidelines || {
        doThis: ['Use dark backgrounds', 'Add subtle gradients', 'Keep it minimal'],
        avoidThis: ['Bright colors', 'Cluttered layouts', 'Generic stock photos'],
      },
      rawAnalysis: analysis.summary || response,
      analyzedAt: new Date(),
    };

    console.log('[BrandAnalyzer] ✅ Brand profile created:', {
      aesthetic: brandProfile.style.aesthetic,
      mood: brandProfile.style.mood,
      primaryColor: brandProfile.colors.primary,
    });

    return brandProfile;
  } catch (error: any) {
    console.error('[BrandAnalyzer] Analysis failed:', error.message);
    return null;
  }
}

/**
 * Get or create brand profile for the store
 */
export async function getBrandProfile(forceRefresh: boolean = false): Promise<BrandProfile | null> {
  // In the future, we could cache this in Firebase
  // For now, analyze fresh each time (or use cached if available)
  
  const logoUrl = await fetchStoreLogo();
  
  if (!logoUrl) {
    console.log('[BrandAnalyzer] No logo found, using default brand profile');
    return getDefaultBrandProfile();
  }

  return analyzeLogo(logoUrl);
}

/**
 * Default brand profile when no logo is available
 */
function getDefaultBrandProfile(): BrandProfile {
  return {
    logoUrl: null,
    colors: {
      primary: '#8b5cf6',      // Purple
      secondary: '#1e1e2e',    // Dark
      accent: '#06b6d4',       // Cyan
      background: '#0f0f1a',   // Very dark
    },
    style: {
      aesthetic: 'tech',
      mood: 'innovative',
      industry: 'digital goods / AI',
    },
    typography: {
      recommended: ['Inter', 'Space Grotesk', 'Outfit', 'Plus Jakarta Sans'],
      style: 'modern sans-serif with tech feel',
    },
    designGuidelines: {
      doThis: [
        'Use dark mode as default',
        'Add subtle purple/cyan gradients',
        'Use clean, minimal layouts',
        'Add subtle animations on hover',
        'Use monospace fonts for code/tech elements',
      ],
      avoidThis: [
        'Bright white backgrounds',
        'Generic stock photos',
        'Overly colorful designs',
        'Cluttered layouts',
        'Serif fonts (except for accents)',
      ],
    },
    rawAnalysis: 'Default tech/AI brand profile for digital goods store',
    analyzedAt: new Date(),
  };
}

/**
 * Generate brand-specific design prompt for AI recommendations
 */
export function generateBrandPrompt(profile: BrandProfile): string {
  return `
BRAND PROFILE:
- Aesthetic: ${profile.style.aesthetic}
- Mood: ${profile.style.mood}
- Industry: ${profile.style.industry}
- Primary Color: ${profile.colors.primary}
- Secondary Color: ${profile.colors.secondary}
- Accent Color: ${profile.colors.accent}
- Typography: ${profile.typography.style} (${profile.typography.recommended.join(', ')})

DESIGN GUIDELINES:
DO: ${profile.designGuidelines.doThis.join(', ')}
AVOID: ${profile.designGuidelines.avoidThis.join(', ')}

All recommendations should align with this brand identity.
`;
}


/**
 * Store Design Agent - Theme Settings Auto-Config
 * 
 * Automatically applies theme settings (colors, fonts, logo) based on brand profile.
 */

import { getCurrentTheme, getThemeAsset, updateThemeAsset } from '../shopify.js';
import { BrandProfile } from './brand-analyzer.js';

/**
 * Apply theme settings automatically based on brand profile
 */
export async function applyThemeSettings(brandProfile: BrandProfile): Promise<{
  success: boolean;
  error?: string;
}> {
  console.log('[DesignAgent] 🎨 Applying theme settings from brand profile...');

  try {
    const theme = await getCurrentTheme();
    if (!theme) {
      return { success: false, error: 'Could not find active theme' };
    }

    // Get current settings
    const settingsData = await getThemeAsset(theme.id, 'config/settings_data.json');
    if (!settingsData?.value) {
      console.log('[DesignAgent] ⚠️  Could not read settings_data.json - theme may use settings_schema.json');
      // Try to update via CSS variables instead
      return { success: true };
    }

    let settings: any;
    try {
      settings = JSON.parse(settingsData.value);
    } catch {
      return { success: false, error: 'Failed to parse settings_data.json' };
    }

    // Update colors based on brand profile
    if (settings.current) {
      // Map brand colors to Shopify theme color settings
      const colorMap: Record<string, string> = {
        'colors_background': brandProfile.colors.background || '#0d0d0d',
        'colors_text': brandProfile.colors.primary || '#e8e8e8',
        'colors_accent': brandProfile.colors.accent || '#b8b8bc',
        'colors_button': brandProfile.colors.secondary || '#3d3d42',
        'colors_button_text': brandProfile.colors.accent || '#ffffff',
      };

      // Update each color setting
      for (const [key, value] of Object.entries(colorMap)) {
        if (settings.current[key]) {
          settings.current[key] = value;
          console.log(`[DesignAgent]   Updated ${key}: ${value}`);
        }
      }

      // Update typography if available
      if (brandProfile.typography.recommended.length > 0) {
        const fontFamily = brandProfile.typography.recommended[0];
        if (settings.current.type_font_family) {
          settings.current.type_font_family = fontFamily;
          console.log(`[DesignAgent]   Updated font: ${fontFamily}`);
        }
      }
    }

    // Save updated settings
    await updateThemeAsset(theme.id, 'config/settings_data.json', JSON.stringify(settings, null, 2));
    console.log('[DesignAgent] ✅ Theme settings applied');

    // Also inject CSS variables as fallback
    await injectCSSVariables(theme.id, brandProfile);

    return { success: true };
  } catch (error: any) {
    console.error('[DesignAgent] Failed to apply theme settings:', error.message);
    // Try CSS fallback even if settings_data.json fails
    try {
      const theme = await getCurrentTheme();
      if (theme) {
        await injectCSSVariables(theme.id, brandProfile);
        return { success: true };
      }
    } catch (cssError) {
      console.error('[DesignAgent] CSS fallback also failed:', cssError);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Inject CSS variables as fallback for themes that don't support settings_data.json
 */
async function injectCSSVariables(themeId: number, brandProfile: BrandProfile): Promise<void> {
  try {
    // Try to find existing custom CSS
    const existingCSS = await getThemeAsset(themeId, 'assets/custom.css') ||
                       await getThemeAsset(themeId, 'assets/theme.css') ||
                       await getThemeAsset(themeId, 'assets/application.css');

    const cssVariables = `
/* DRACANUS AI Theme Variables - Auto-injected */
:root {
  --dracanus-bg-darkest: ${brandProfile.colors.background || '#0d0d0d'};
  --dracanus-bg-dark: #131315;
  --dracanus-bg-surface: ${brandProfile.colors.primary || '#1a1a1a'};
  --dracanus-bg-card: #141416;
  --dracanus-border-dark: #2a2a2e;
  --dracanus-border-metallic: ${brandProfile.colors.secondary || '#2d2d2d'};
  --dracanus-text-primary: ${brandProfile.colors.accent || '#ffffff'};
  --dracanus-text-secondary: #8a8a8f;
  --dracanus-accent-silver: #b8b8bc;
}

html, body {
  background: var(--dracanus-bg-darkest) !important;
  color: var(--dracanus-text-primary) !important;
}
`;

    const cssKey = existingCSS?.key?.replace('assets/', '') || 'custom.css';
    const finalCSS = existingCSS?.value 
      ? `${existingCSS.value}\n\n${cssVariables}`
      : cssVariables;

    await updateThemeAsset(themeId, `assets/${cssKey}`, finalCSS);
    console.log('[DesignAgent] ✅ CSS variables injected');
  } catch (error: any) {
    console.warn('[DesignAgent] Could not inject CSS variables:', error.message);
  }
}

/**
 * Apply DRACANUS theme automatically (when logo is detected)
 */
export async function applyDracanusThemeAuto(): Promise<{
  success: boolean;
  error?: string;
}> {
  console.log('[DesignAgent] 🐉 Auto-applying DRACANUS theme...');

  try {
    const theme = await getCurrentTheme();
    if (!theme) {
      return { success: false, error: 'Could not find active theme' };
    }

    // DRACANUS brand profile
    const dracanusProfile: BrandProfile = {
      logoUrl: null,
      colors: {
        primary: '#1a1a1a',
        secondary: '#2d2d2d',
        accent: '#ffffff',
        background: '#0d0d0d',
      },
      style: {
        aesthetic: 'tech',
        mood: 'innovative',
        industry: 'AI / digital goods',
      },
      typography: {
        recommended: ['Inter', 'SF Pro Display', 'Segoe UI'],
        style: 'modern sans-serif',
      },
      designGuidelines: {
        doThis: [
          'Use dark backgrounds (#0d0d0d)',
          'Metallic silver accents (#b8b8bc)',
          'Sharp, angular design elements',
          'Minimal border radius (4px)',
          'Tech-forward aesthetic',
        ],
        avoidThis: [
          'Bright colors',
          'Rounded corners',
          'Playful fonts',
          'Light backgrounds',
        ],
      },
      rawAnalysis: 'DRACANUS AI - Dark, metallic, tech-forward brand',
      analyzedAt: new Date(),
    };

    // Apply theme settings
    await applyThemeSettings(dracanusProfile);

    console.log('[DesignAgent] ✅ DRACANUS theme auto-applied');
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}


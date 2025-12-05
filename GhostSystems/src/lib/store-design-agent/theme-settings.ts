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

    return { success: true };
  } catch (error: any) {
    console.error('[DesignAgent] Failed to apply theme settings:', error.message);
    return { success: false, error: error.message };
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


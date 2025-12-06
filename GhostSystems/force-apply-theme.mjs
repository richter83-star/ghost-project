#!/usr/bin/env node
/**
 * Force Apply DRACANUS Theme
 * Immediately applies DRACANUS brand colors and settings to Shopify theme.
 */

import 'dotenv/config';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin if not already initialized
if (!global.firebaseAdminInitialized) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
    if (serviceAccount.project_id) {
      initializeApp({
        credential: cert(serviceAccount),
      });
      global.firebaseAdminInitialized = true;
    }
  } catch (error) {
    console.warn('Firebase Admin not initialized (optional for theme application)');
  }
}

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL || '';
const SHOPIFY_ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN || '';
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';
const BASE_URL = `https://${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}`;

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_TOKEN,
  };
}

// DRACANUS Brand Profile
const DRACANUS_PROFILE = {
  colors: {
    primary: '#1a1a1a',
    secondary: '#2d2d2d',
    accent: '#ffffff',
    background: '#0d0d0d',
    metallic: '#b8b8bc',
  },
  typography: {
    recommended: ['Inter', 'SF Pro Display', 'Segoe UI'],
  },
};

async function getCurrentTheme() {
  const response = await fetch(`${BASE_URL}/themes.json`, { headers: getHeaders() });
  const data = await response.json();
  return data.themes?.find(t => t.role === 'main') || data.themes?.[0];
}

async function getThemeAsset(themeId, key) {
  try {
    const response = await fetch(`${BASE_URL}/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(key)}`, { 
      headers: getHeaders() 
    });
    const data = await response.json();
    return data.asset;
  } catch (error) {
    console.warn(`Could not fetch ${key}:`, error.message);
    return null;
  }
}

async function updateThemeAsset(themeId, key, value) {
  const response = await fetch(`${BASE_URL}/themes/${themeId}/assets.json`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ asset: { key, value } }),
  });
  if (!response.ok) {
    throw new Error(`Failed to update ${key}: ${response.statusText}`);
  }
  return await response.json();
}

async function applyThemeSettings(theme) {
  console.log('🎨 Applying DRACANUS theme settings...\n');

  // Method 1: Update settings_data.json
  const settingsData = await getThemeAsset(theme.id, 'config/settings_data.json');
  if (settingsData?.value) {
    try {
      const settings = JSON.parse(settingsData.value);
      
      if (settings.current) {
        // Map DRACANUS colors to Shopify theme settings
        const colorMap = {
          'colors_background': DRACANUS_PROFILE.colors.background,
          'colors_text': DRACANUS_PROFILE.colors.accent,
          'colors_accent': DRACANUS_PROFILE.colors.metallic,
          'colors_button': DRACANUS_PROFILE.colors.secondary,
          'colors_button_text': DRACANUS_PROFILE.colors.accent,
          'colors_solid_button_labels': DRACANUS_PROFILE.colors.accent,
        };

        let updated = false;
        for (const [key, value] of Object.entries(colorMap)) {
          if (settings.current[key] !== undefined) {
            settings.current[key] = value;
            console.log(`  ✅ Updated ${key}: ${value}`);
            updated = true;
          }
        }

        if (updated) {
          await updateThemeAsset(theme.id, 'config/settings_data.json', JSON.stringify(settings, null, 2));
          console.log('\n✅ Theme settings applied via settings_data.json\n');
        }
      }
    } catch (error) {
      console.warn('⚠️  Could not parse settings_data.json:', error.message);
    }
  } else {
    console.log('⚠️  settings_data.json not found, using CSS method\n');
  }

  // Method 2: Inject CSS variables (always do this as fallback)
  const existingCSS = await getThemeAsset(theme.id, 'assets/custom.css') || 
                      await getThemeAsset(theme.id, 'assets/theme.css') ||
                      await getThemeAsset(theme.id, 'assets/application.css');

  const dracanusCSS = `
/* ═══════════════════════════════════════════════════════════════
   DRACANUS AI - FORCE APPLIED THEME v2.0
   Applied: ${new Date().toISOString()}
   ═══════════════════════════════════════════════════════════════ */

:root {
  --dracanus-bg-darkest: ${DRACANUS_PROFILE.colors.background};
  --dracanus-bg-dark: #131315;
  --dracanus-bg-surface: ${DRACANUS_PROFILE.colors.primary};
  --dracanus-bg-card: #141416;
  --dracanus-border-dark: #2a2a2e;
  --dracanus-border-metallic: ${DRACANUS_PROFILE.colors.secondary};
  --dracanus-text-primary: ${DRACANUS_PROFILE.colors.accent};
  --dracanus-text-secondary: #8a8a8f;
  --dracanus-accent-silver: ${DRACANUS_PROFILE.colors.metallic};
}

html, body {
  background: var(--dracanus-bg-darkest) !important;
  color: var(--dracanus-text-primary) !important;
}

header, .header, .site-header {
  background: rgba(13,13,13,0.95) !important;
  border-bottom: 1px solid var(--dracanus-border-dark) !important;
}

.product-card, .card, .product-item {
  background: linear-gradient(145deg, #18181a 0%, #141416 50%, #101012 100%) !important;
  border: 1px solid var(--dracanus-border-dark) !important;
}

.btn, button, .button {
  background: linear-gradient(145deg, #1e1e20 0%, #2a2a2e 50%, #1e1e20 100%) !important;
  color: var(--dracanus-text-primary) !important;
  border: 1px solid var(--dracanus-border-metallic) !important;
}

.btn:hover, button:hover {
  background: linear-gradient(145deg, #2a2a2e 0%, #3a3a3f 50%, #2a2a2e 100%) !important;
  border-color: var(--dracanus-accent-silver) !important;
}
`;

  const cssKey = existingCSS ? Object.keys(existingCSS)[0]?.replace('assets/', '') || 'custom.css' : 'custom.css';
  const finalCSS = existingCSS?.value 
    ? `${existingCSS.value}\n\n${dracanusCSS}`
    : dracanusCSS;

  await updateThemeAsset(theme.id, `assets/${cssKey}`, finalCSS);
  console.log(`✅ CSS theme applied to assets/${cssKey}\n`);
}

async function main() {
  console.log('\n🐉 DRACANUS AI - Force Apply Theme\n');
  console.log('='.repeat(60));

  if (!SHOPIFY_STORE_URL || !SHOPIFY_ADMIN_API_TOKEN) {
    console.error('❌ Missing Shopify credentials');
    console.error('   Set SHOPIFY_STORE_URL and SHOPIFY_ADMIN_API_TOKEN');
    process.exit(1);
  }

  console.log(`Store: ${SHOPIFY_STORE_URL}\n`);

  try {
    console.log('📡 Fetching current theme...');
    const theme = await getCurrentTheme();
    if (!theme) {
      console.error('❌ Could not find active theme');
      process.exit(1);
    }

    console.log(`✅ Found: ${theme.name} (ID: ${theme.id})\n`);

    await applyThemeSettings(theme);

    console.log('='.repeat(60));
    console.log('🎉 SUCCESS! DRACANUS theme force-applied');
    console.log('='.repeat(60));
    console.log('\n💡 Theme colors and branding are now consistent');
    console.log('   Refresh your store to see the changes\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();


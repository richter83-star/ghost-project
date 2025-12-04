#!/usr/bin/env node
/**
 * Apply DRACANUS AI Brand Theme
 * Applies dark, metallic, tech-forward design to match logo.
 * 
 * Run: node apply-dracanus-theme.mjs
 */

import 'dotenv/config';

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

// ============================================================================
// DRACANUS BRAND COLORS & STYLE
// ============================================================================

const DRACANUS_THEME = {
  // Primary colors from logo
  colors: {
    primary: '#1a1a1a',        // Dark charcoal (background)
    secondary: '#2d2d2d',       // Medium gray (text)
    accent: '#ffffff',         // Metallic white highlights
    metallic: '#4a4a4a',       // Metallic gray (borders/accents)
    dark: '#0a0a0a',           // Pure black (shadows)
    text: '#e0e0e0',           // Light gray text
    textMuted: '#999999',       // Muted text
  },
  
  // Typography - modern, bold, angular
  fonts: {
    heading: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    body: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"SF Mono", "Monaco", "Courier New", monospace',
  },
  
  // Design tokens
  style: {
    borderRadius: '4px',       // Sharp, minimal rounding
    shadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    shadowStrong: '0 8px 24px rgba(0, 0, 0, 0.5)',
    border: '1px solid #333333',
    transition: 'all 0.2s ease',
  },
};

// ============================================================================
// SHOPIFY THEME CUSTOMIZATION
// ============================================================================

async function getCurrentTheme() {
  const response = await fetch(`${BASE_URL}/themes.json`, { headers: getHeaders() });
  const data = await response.json();
  return data.themes?.find(t => t.role === 'main') || data.themes?.[0];
}

async function getThemeAssets(themeId) {
  const response = await fetch(`${BASE_URL}/themes/${themeId}/assets.json`, { headers: getHeaders() });
  const data = await response.json();
  return data.assets || [];
}

async function getThemeAsset(themeId, key) {
  const response = await fetch(`${BASE_URL}/themes/${themeId}/assets.json?asset[key]=${key}`, { headers: getHeaders() });
  const data = await response.json();
  return data.asset;
}

async function updateThemeAsset(themeId, key, value) {
  await fetch(`${BASE_URL}/themes/${themeId}/assets.json`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({
      asset: { key, value },
    }),
  });
}

async function getThemeSettings(themeId) {
  const configAsset = await getThemeAsset(themeId, 'config/settings_schema.json');
  if (!configAsset) return null;
  
  try {
    return JSON.parse(configAsset.value);
  } catch {
    return null;
  }
}

// ============================================================================
// GENERATE CUSTOM CSS
// ============================================================================

function generateDracanusCSS() {
  return `
/* DRACANUS AI Brand Theme - Dark Metallic Tech Aesthetic */

:root {
  --dracanus-primary: ${DRACANUS_THEME.colors.primary};
  --dracanus-secondary: ${DRACANUS_THEME.colors.secondary};
  --dracanus-accent: ${DRACANUS_THEME.colors.accent};
  --dracanus-metallic: ${DRACANUS_THEME.colors.metallic};
  --dracanus-dark: ${DRACANUS_THEME.colors.dark};
  --dracanus-text: ${DRACANUS_THEME.colors.text};
  --dracanus-text-muted: ${DRACANUS_THEME.colors.textMuted};
}

/* Global Overrides */
body {
  background-color: var(--dracanus-primary) !important;
  color: var(--dracanus-text) !important;
  font-family: ${DRACANUS_THEME.fonts.body} !important;
}

/* Headers */
h1, h2, h3, h4, h5, h6 {
  color: var(--dracanus-accent) !important;
  font-family: ${DRACANUS_THEME.fonts.heading} !important;
  font-weight: 700 !important;
  letter-spacing: -0.02em !important;
}

/* Navigation */
.header, .site-header {
  background-color: var(--dracanus-dark) !important;
  border-bottom: 1px solid var(--dracanus-metallic) !important;
  box-shadow: ${DRACANUS_THEME.style.shadow} !important;
}

.header__menu-item, .site-nav__link {
  color: var(--dracanus-text) !important;
  font-weight: 500 !important;
  transition: ${DRACANUS_THEME.style.transition} !important;
}

.header__menu-item:hover, .site-nav__link:hover {
  color: var(--dracanus-accent) !important;
}

/* Buttons */
.btn, .button, button[type="submit"] {
  background-color: var(--dracanus-metallic) !important;
  color: var(--dracanus-accent) !important;
  border: 1px solid var(--dracanus-metallic) !important;
  border-radius: ${DRACANUS_THEME.style.borderRadius} !important;
  font-weight: 600 !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
  transition: ${DRACANUS_THEME.style.transition} !important;
  box-shadow: ${DRACANUS_THEME.style.shadow} !important;
}

.btn:hover, .button:hover, button[type="submit"]:hover {
  background-color: var(--dracanus-accent) !important;
  color: var(--dracanus-dark) !important;
  box-shadow: ${DRACANUS_THEME.style.shadowStrong} !important;
  transform: translateY(-2px) !important;
}

.btn--primary, .button--primary {
  background: linear-gradient(135deg, var(--dracanus-metallic) 0%, var(--dracanus-secondary) 100%) !important;
  border-color: var(--dracanus-accent) !important;
}

/* Product Cards */
.product-card, .product-item, .grid__item {
  background-color: var(--dracanus-secondary) !important;
  border: 1px solid var(--dracanus-metallic) !important;
  border-radius: ${DRACANUS_THEME.style.borderRadius} !important;
  box-shadow: ${DRACANUS_THEME.style.shadow} !important;
  transition: ${DRACANUS_THEME.style.transition} !important;
  overflow: hidden !important;
}

.product-card:hover, .product-item:hover {
  transform: translateY(-4px) !important;
  box-shadow: ${DRACANUS_THEME.style.shadowStrong} !important;
  border-color: var(--dracanus-accent) !important;
}

.product-card__title, .product-item__title {
  color: var(--dracanus-accent) !important;
  font-weight: 600 !important;
}

.product-card__price, .product-item__price {
  color: var(--dracanus-text) !important;
  font-weight: 700 !important;
}

/* Forms */
input, textarea, select {
  background-color: var(--dracanus-secondary) !important;
  color: var(--dracanus-text) !important;
  border: 1px solid var(--dracanus-metallic) !important;
  border-radius: ${DRACANUS_THEME.style.borderRadius} !important;
}

input:focus, textarea:focus, select:focus {
  border-color: var(--dracanus-accent) !important;
  outline: none !important;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.1) !important;
}

/* Footer */
.footer, .site-footer {
  background-color: var(--dracanus-dark) !important;
  border-top: 1px solid var(--dracanus-metallic) !important;
  color: var(--dracanus-text-muted) !important;
}

.footer__link {
  color: var(--dracanus-text-muted) !important;
}

.footer__link:hover {
  color: var(--dracanus-accent) !important;
}

/* Hero Section */
.hero, .banner {
  background: linear-gradient(135deg, var(--dracanus-dark) 0%, var(--dracanus-primary) 100%) !important;
  border-bottom: 1px solid var(--dracanus-metallic) !important;
}

.hero__title, .banner__title {
  color: var(--dracanus-accent) !important;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5) !important;
}

/* Badges & Tags */
.badge, .tag {
  background-color: var(--dracanus-metallic) !important;
  color: var(--dracanus-accent) !important;
  border-radius: ${DRACANUS_THEME.style.borderRadius} !important;
  font-weight: 600 !important;
  font-size: 0.75rem !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
}

/* Metallic Accent Lines */
.section-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--dracanus-metallic), transparent);
  margin: 2rem 0;
}

/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--dracanus-dark);
}

::-webkit-scrollbar-thumb {
  background: var(--dracanus-metallic);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--dracanus-accent);
}

/* Loading States */
.loading {
  border-color: var(--dracanus-metallic) !important;
  border-top-color: var(--dracanus-accent) !important;
}

/* Selection */
::selection {
  background-color: var(--dracanus-accent) !important;
  color: var(--dracanus-dark) !important;
}
`;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n🐉 Applying DRACANUS AI Brand Theme\n');
  console.log('='.repeat(50));

  if (!SHOPIFY_STORE_URL || !SHOPIFY_ADMIN_API_TOKEN) {
    console.error('❌ Missing Shopify credentials');
    process.exit(1);
  }

  console.log(`Store: ${SHOPIFY_STORE_URL}\n`);

  // Get current theme
  console.log('📥 Fetching current theme...');
  const theme = await getCurrentTheme();
  if (!theme) {
    console.error('❌ Could not find active theme');
    process.exit(1);
  }

  console.log(`   Theme: ${theme.name} (ID: ${theme.id})\n`);

  // Check for existing custom CSS
  console.log('📝 Checking for custom CSS file...');
  const assets = await getThemeAssets(theme.id);
  const hasCustomCSS = assets.some(a => a.key === 'assets/custom.css' || a.key === 'assets/dracanus.css');

  const cssKey = hasCustomCSS ? 'assets/custom.css' : 'assets/dracanus.css';
  const existingCSS = hasCustomCSS ? await getThemeAsset(theme.id, cssKey) : null;

  // Generate CSS
  console.log('🎨 Generating DRACANUS brand CSS...');
  const dracanusCSS = generateDracanusCSS();
  const finalCSS = existingCSS ? `${existingCSS.value}\n\n${dracanusCSS}` : dracanusCSS;

  // Apply CSS
  console.log(`   Updating ${cssKey}...`);
  try {
    await updateThemeAsset(theme.id, cssKey, finalCSS);
    console.log('   ✅ CSS applied successfully\n');
  } catch (error) {
    console.error(`   ❌ Failed: ${error.message}\n`);
    process.exit(1);
  }

  // Summary
  console.log('='.repeat(50));
  console.log('✅ DRACANUS THEME APPLIED');
  console.log('='.repeat(50));
  console.log('\n📋 Next Steps in Shopify Admin:');
  console.log('   1. Go to: Online Store > Themes > Customize');
  console.log('   2. Theme Settings > Colors:');
  console.log(`      - Background: ${DRACANUS_THEME.colors.primary}`);
  console.log(`      - Text: ${DRACANUS_THEME.colors.text}`);
  console.log(`      - Accent: ${DRACANUS_THEME.colors.accent}`);
  console.log('   3. Theme Settings > Typography:');
  console.log(`      - Heading: ${DRACANUS_THEME.fonts.heading}`);
  console.log(`      - Body: ${DRACANUS_THEME.fonts.body}`);
  console.log('   4. Upload your DRACANUS logo in Header section');
  console.log('   5. Preview and publish!\n');
  console.log('🎨 Brand Colors:');
  console.log(`   Primary: ${DRACANUS_THEME.colors.primary}`);
  console.log(`   Secondary: ${DRACANUS_THEME.colors.secondary}`);
  console.log(`   Accent: ${DRACANUS_THEME.colors.accent}`);
  console.log(`   Metallic: ${DRACANUS_THEME.colors.metallic}`);
  console.log('');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});


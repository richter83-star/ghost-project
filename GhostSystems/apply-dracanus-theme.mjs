#!/usr/bin/env node
/**
 * Apply DRACANUS AI Theme (Plain JS version)
 * Applies dark, metallic, tech-forward theme to Shopify store.
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

// DRACANUS AI CSS Theme
const DRACANUS_CSS = `/* ═══════════════════════════════════════════════════════════════
   DRACANUS AI - PREMIUM DARK THEME v2.0
   ═══════════════════════════════════════════════════════════════ */

:root {
  --bg-darkest: #0d0d0d;
  --bg-dark: #131315;
  --bg-surface: #1a1a1c;
  --bg-card: #141416;
  --border-dark: #2a2a2e;
  --border-metallic: #3d3d42;
  --text-primary: #e8e8e8;
  --text-secondary: #8a8a8f;
  --text-muted: #5a5a5f;
  --accent-silver: #b8b8bc;
  --accent-metallic: linear-gradient(135deg, #4a4a4f 0%, #6a6a70 50%, #4a4a4f 100%);
}

html, body {
  background: var(--bg-darkest) !important;
  background-image: 
    radial-gradient(ellipse at 50% 0%, rgba(40,40,45,0.3) 0%, transparent 50%),
    linear-gradient(180deg, #0d0d0d 0%, #101012 50%, #0d0d0d 100%) !important;
  color: var(--text-primary) !important;
  font-family: 'Inter', 'Segoe UI', -apple-system, sans-serif !important;
  min-height: 100vh;
}

header, .header, .site-header {
  background: rgba(13,13,13,0.95) !important;
  backdrop-filter: blur(10px) !important;
  border-bottom: 1px solid var(--border-dark) !important;
  box-shadow: 0 4px 30px rgba(0,0,0,0.5) !important;
}

.header__menu-item, nav a, .site-nav a {
  color: var(--text-secondary) !important;
  font-weight: 500 !important;
  font-size: 14px !important;
  letter-spacing: 0.5px !important;
  text-transform: uppercase !important;
  transition: all 0.3s ease !important;
}

.header__menu-item:hover, nav a:hover {
  color: var(--text-primary) !important;
  background: rgba(255,255,255,0.05) !important;
}

.product-card, .card, .product-item {
  background: linear-gradient(145deg, #18181a 0%, #141416 50%, #101012 100%) !important;
  border: 1px solid #2a2a2e !important;
  border-radius: 12px !important;
  overflow: hidden !important;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.03) !important;
}

.product-card:hover, .card:hover {
  transform: translateY(-8px) !important;
  border-color: #3d3d42 !important;
  box-shadow: 0 16px 48px rgba(0,0,0,0.6), 0 0 30px rgba(80,80,90,0.1) !important;
}

.card__heading, .product-card__title {
  color: #e8e8e8 !important;
  font-weight: 600 !important;
  font-size: 18px !important;
}

.price, .product-price {
  color: var(--accent-silver) !important;
  font-weight: 600 !important;
  font-size: 18px !important;
}

.btn, button, .button {
  background: linear-gradient(145deg, #1e1e20 0%, #2a2a2e 50%, #1e1e20 100%) !important;
  color: #e8e8e8 !important;
  border: 1px solid #3a3a3f !important;
  border-radius: 6px !important;
  font-weight: 600 !important;
  letter-spacing: 1.5px !important;
  text-transform: uppercase !important;
  padding: 14px 28px !important;
  transition: all 0.3s ease !important;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
}

.btn:hover, button:hover {
  background: linear-gradient(145deg, #2a2a2e 0%, #3a3a3f 50%, #2a2a2e 100%) !important;
  border-color: #4a4a4f !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 6px 20px rgba(0,0,0,0.5) !important;
}

.btn--primary, .shopify-payment-button__button {
  background: linear-gradient(145deg, #2d2d30 0%, #3d3d42 50%, #2d2d30 100%) !important;
  border: 1px solid #4a4a4f !important;
}

footer, .footer {
  background: var(--bg-dark) !important;
  border-top: 1px solid var(--border-dark) !important;
  color: var(--text-secondary) !important;
}

h1, h2, h3, h4, h5, h6 {
  color: var(--text-primary) !important;
  font-weight: 700 !important;
}

input, textarea, select {
  background: var(--bg-surface) !important;
  border: 1px solid var(--border-dark) !important;
  color: var(--text-primary) !important;
  border-radius: 4px !important;
  padding: 12px 16px !important;
}

input:focus, textarea:focus {
  border-color: var(--border-metallic) !important;
  outline: none !important;
  box-shadow: 0 0 0 2px rgba(100,100,110,0.2) !important;
}

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: var(--bg-darkest); }
::-webkit-scrollbar-thumb { background: var(--border-metallic); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--accent-silver); }`;

async function getCurrentTheme() {
  const response = await fetch(`${BASE_URL}/themes.json`, { headers: getHeaders() });
  const data = await response.json();
  return data.themes?.find(t => t.role === 'main') || data.themes?.[0];
}

async function getThemeAsset(themeId, key) {
  try {
    const response = await fetch(`${BASE_URL}/themes/${themeId}/assets.json?asset[key]=${key}`, { headers: getHeaders() });
    const data = await response.json();
    return data.asset;
  } catch {
    return null;
  }
}

async function updateThemeAsset(themeId, key, value) {
  await fetch(`${BASE_URL}/themes/${themeId}/assets.json`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ asset: { key, value } }),
  });
}

async function main() {
  console.log('\n🐉 DRACANUS AI Theme Installer\n');
  console.log('='.repeat(50));

  if (!SHOPIFY_STORE_URL || !SHOPIFY_ADMIN_API_TOKEN) {
    console.error('❌ Missing Shopify credentials');
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

    console.log('🔍 Checking for existing custom.css...');
    const existingCSS = await getThemeAsset(theme.id, 'assets/custom.css');
    
    const finalCSS = existingCSS?.value 
      ? `${existingCSS.value}\n\n${DRACANUS_CSS}`
      : DRACANUS_CSS;

    console.log('🎨 Applying DRACANUS theme...');
    await updateThemeAsset(theme.id, 'assets/custom.css', finalCSS);
    console.log('✅ Theme applied!\n');

    console.log('='.repeat(50));
    console.log('🎉 SUCCESS!');
    console.log('='.repeat(50));
    console.log('\n💡 Next steps:');
    console.log('   1. Go to: Online Store > Themes > Customize');
    console.log('   2. Upload your DRACANUS logo in Header section');
    console.log('   3. Set colors in Theme Settings (use dark colors)');
    console.log('   4. Preview and publish!\n');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

/**
 * Apply Dracanus AI Theme
 * 
 * Transforms the Shopify store to match the Dracanus AI brand identity:
 * - Dark, futuristic aesthetic
 * - Angular, geometric design language
 * - Metallic silver accents
 * - Premium tech AI vibes
 */

import 'dotenv/config';
import {
  getCurrentTheme,
  updateThemeAsset,
  getThemeAsset,
} from '../lib/shopify.js';

// Dracanus AI Color Palette (extracted from logo)
const COLORS = {
  // Primary backgrounds
  darkest: '#0a0a0f',      // Near black
  dark: '#121218',          // Dark background
  surface: '#1a1a24',       // Card/surface background
  
  // Secondary tones
  slate: '#1e2530',         // Dark slate from logo
  charcoal: '#2d3748',      // Charcoal gray
  
  // Metallic accents (from logo silver)
  silver: '#9ca3af',        // Silver metallic
  lightSilver: '#d1d5db',   // Light silver for text
  
  // Tech accent colors
  cyan: '#06b6d4',          // Tech cyan accent
  purple: '#8b5cf6',        // AI purple accent
  
  // Text
  textPrimary: '#f3f4f6',   // Primary text
  textSecondary: '#9ca3af', // Secondary text
  textMuted: '#6b7280',     // Muted text
};

// Dracanus AI Custom CSS
const DRACANUS_CSS = `
/*
 * ═══════════════════════════════════════════════════════════════
 * DRACANUS AI - PREMIUM DARK THEME
 * Futuristic • Angular • Metallic • AI-Powered
 * ═══════════════════════════════════════════════════════════════
 */

/* ─────────────────────────────────────────────────────────────
   CSS Variables - Dracanus AI Color System
   ───────────────────────────────────────────────────────────── */
:root {
  /* Primary Colors */
  --dracanus-darkest: ${COLORS.darkest};
  --dracanus-dark: ${COLORS.dark};
  --dracanus-surface: ${COLORS.surface};
  --dracanus-slate: ${COLORS.slate};
  --dracanus-charcoal: ${COLORS.charcoal};
  
  /* Metallic Accents */
  --dracanus-silver: ${COLORS.silver};
  --dracanus-light-silver: ${COLORS.lightSilver};
  
  /* Tech Accents */
  --dracanus-cyan: ${COLORS.cyan};
  --dracanus-purple: ${COLORS.purple};
  
  /* Gradients */
  --dracanus-gradient-dark: linear-gradient(135deg, ${COLORS.darkest} 0%, ${COLORS.dark} 50%, ${COLORS.slate} 100%);
  --dracanus-gradient-metallic: linear-gradient(135deg, ${COLORS.charcoal} 0%, ${COLORS.silver} 50%, ${COLORS.charcoal} 100%);
  --dracanus-gradient-glow: linear-gradient(135deg, ${COLORS.cyan}20 0%, ${COLORS.purple}20 100%);
  
  /* Text */
  --dracanus-text: ${COLORS.textPrimary};
  --dracanus-text-secondary: ${COLORS.textSecondary};
  --dracanus-text-muted: ${COLORS.textMuted};
  
  /* Borders & Effects */
  --dracanus-border: ${COLORS.charcoal};
  --dracanus-glow: 0 0 20px ${COLORS.cyan}40;
  --dracanus-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
}

/* ─────────────────────────────────────────────────────────────
   Base Styles - Dark Futuristic Foundation
   ───────────────────────────────────────────────────────────── */
html, body {
  background: var(--dracanus-darkest) !important;
  color: var(--dracanus-text) !important;
  font-family: 'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif !important;
}

/* Main content area */
.main-content, main, #MainContent, .shopify-section {
  background: var(--dracanus-darkest) !important;
}

/* ─────────────────────────────────────────────────────────────
   Header - Angular Metallic Design
   ───────────────────────────────────────────────────────────── */
header, .header, .site-header, .header-wrapper, #shopify-section-header {
  background: var(--dracanus-gradient-dark) !important;
  border-bottom: 1px solid var(--dracanus-border) !important;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.5) !important;
}

/* Navigation Links */
.header__menu-item, nav a, .site-nav a, .header-menu-item {
  color: var(--dracanus-silver) !important;
  font-weight: 500 !important;
  letter-spacing: 0.5px !important;
  text-transform: uppercase !important;
  font-size: 13px !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  position: relative !important;
}

.header__menu-item:hover, nav a:hover, .site-nav a:hover {
  color: var(--dracanus-cyan) !important;
  text-shadow: 0 0 10px var(--dracanus-cyan) !important;
}

/* Animated underline on hover */
.header__menu-item::after, nav a::after {
  content: '' !important;
  position: absolute !important;
  bottom: -2px !important;
  left: 0 !important;
  width: 0 !important;
  height: 2px !important;
  background: linear-gradient(90deg, var(--dracanus-cyan), var(--dracanus-purple)) !important;
  transition: width 0.3s ease !important;
}

.header__menu-item:hover::after, nav a:hover::after {
  width: 100% !important;
}

/* ─────────────────────────────────────────────────────────────
   Product Cards - Geometric Tech Cards
   ───────────────────────────────────────────────────────────── */
.product-card, .card, .product-item, .grid__item .card {
  background: var(--dracanus-surface) !important;
  border: 1px solid var(--dracanus-border) !important;
  border-radius: 4px !important;
  overflow: hidden !important;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
  position: relative !important;
}

.product-card::before, .card::before {
  content: '' !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  height: 2px !important;
  background: linear-gradient(90deg, transparent, var(--dracanus-cyan), var(--dracanus-purple), transparent) !important;
  opacity: 0 !important;
  transition: opacity 0.3s ease !important;
}

.product-card:hover, .card:hover {
  transform: translateY(-8px) !important;
  border-color: var(--dracanus-cyan) !important;
  box-shadow: var(--dracanus-glow), var(--dracanus-shadow) !important;
}

.product-card:hover::before, .card:hover::before {
  opacity: 1 !important;
}

/* Product Titles */
.product-card__title, .card__heading, .product-title, h3.card__heading a {
  color: var(--dracanus-light-silver) !important;
  font-weight: 600 !important;
  letter-spacing: 0.3px !important;
}

/* Product Prices */
.price, .product-price, .price__regular, .money {
  color: var(--dracanus-cyan) !important;
  font-weight: 700 !important;
  font-size: 1.1em !important;
}

/* ─────────────────────────────────────────────────────────────
   Buttons - Angular Tech Buttons
   ───────────────────────────────────────────────────────────── */
.btn, button, .button, .shopify-payment-button__button, input[type="submit"] {
  background: linear-gradient(135deg, var(--dracanus-slate), var(--dracanus-charcoal)) !important;
  color: var(--dracanus-light-silver) !important;
  border: 1px solid var(--dracanus-silver) !important;
  border-radius: 2px !important;
  font-weight: 600 !important;
  letter-spacing: 1px !important;
  text-transform: uppercase !important;
  padding: 12px 28px !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
  position: relative !important;
  overflow: hidden !important;
}

.btn::before, button::before, .button::before {
  content: '' !important;
  position: absolute !important;
  top: 0 !important;
  left: -100% !important;
  width: 100% !important;
  height: 100% !important;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent) !important;
  transition: left 0.5s ease !important;
}

.btn:hover, button:hover, .button:hover {
  background: linear-gradient(135deg, var(--dracanus-charcoal), var(--dracanus-cyan)) !important;
  border-color: var(--dracanus-cyan) !important;
  box-shadow: var(--dracanus-glow) !important;
  transform: translateY(-2px) !important;
}

.btn:hover::before, button:hover::before {
  left: 100% !important;
}

/* Primary/Add to Cart buttons */
.btn--primary, .product-form__submit, .cart__submit {
  background: linear-gradient(135deg, var(--dracanus-cyan), var(--dracanus-purple)) !important;
  border: none !important;
  color: white !important;
}

.btn--primary:hover, .product-form__submit:hover {
  background: linear-gradient(135deg, var(--dracanus-purple), var(--dracanus-cyan)) !important;
  box-shadow: 0 0 30px var(--dracanus-cyan) !important;
}

/* ─────────────────────────────────────────────────────────────
   Footer - Sleek Dark Footer
   ───────────────────────────────────────────────────────────── */
footer, .footer, .site-footer, #shopify-section-footer {
  background: var(--dracanus-darkest) !important;
  border-top: 1px solid var(--dracanus-border) !important;
  color: var(--dracanus-text-secondary) !important;
}

footer a, .footer a {
  color: var(--dracanus-silver) !important;
  transition: color 0.3s ease !important;
}

footer a:hover, .footer a:hover {
  color: var(--dracanus-cyan) !important;
}

/* ─────────────────────────────────────────────────────────────
   Product Page - Premium Detail View
   ───────────────────────────────────────────────────────────── */
.product, .product-single, .product__info-wrapper {
  background: var(--dracanus-dark) !important;
}

.product__title, .product-single__title {
  color: var(--dracanus-light-silver) !important;
  font-size: 2.5rem !important;
  font-weight: 700 !important;
  letter-spacing: -0.5px !important;
}

.product__description, .product-single__description {
  color: var(--dracanus-text-secondary) !important;
  line-height: 1.8 !important;
}

/* Product images */
.product__media, .product-single__photo {
  border-radius: 4px !important;
  overflow: hidden !important;
  border: 1px solid var(--dracanus-border) !important;
}

/* ─────────────────────────────────────────────────────────────
   Collection Pages - Grid Enhancement
   ───────────────────────────────────────────────────────────── */
.collection-hero {
  background: var(--dracanus-gradient-dark) !important;
  padding: 60px 0 !important;
}

.collection-hero__title {
  color: var(--dracanus-light-silver) !important;
  font-size: 3rem !important;
  font-weight: 800 !important;
  text-transform: uppercase !important;
  letter-spacing: 2px !important;
}

/* ─────────────────────────────────────────────────────────────
   Forms & Inputs - Tech Style Inputs
   ───────────────────────────────────────────────────────────── */
input, textarea, select, .field__input {
  background: var(--dracanus-surface) !important;
  border: 1px solid var(--dracanus-border) !important;
  color: var(--dracanus-text) !important;
  border-radius: 2px !important;
  padding: 12px 16px !important;
  transition: all 0.3s ease !important;
}

input:focus, textarea:focus, select:focus {
  border-color: var(--dracanus-cyan) !important;
  box-shadow: 0 0 10px var(--dracanus-cyan)40 !important;
  outline: none !important;
}

/* ─────────────────────────────────────────────────────────────
   Cart - Sleek Cart Design
   ───────────────────────────────────────────────────────────── */
.cart, .cart-drawer, .cart__contents {
  background: var(--dracanus-dark) !important;
}

.cart-item, .cart__item {
  border-bottom: 1px solid var(--dracanus-border) !important;
  padding: 20px 0 !important;
}

/* ─────────────────────────────────────────────────────────────
   Announcement Bar - Subtle Glow
   ───────────────────────────────────────────────────────────── */
.announcement-bar {
  background: linear-gradient(90deg, var(--dracanus-darkest), var(--dracanus-slate), var(--dracanus-darkest)) !important;
  border-bottom: 1px solid var(--dracanus-cyan)40 !important;
  color: var(--dracanus-silver) !important;
}

/* ─────────────────────────────────────────────────────────────
   Special Effects - AI Tech Vibes
   ───────────────────────────────────────────────────────────── */

/* Subtle scan line effect on hover */
.product-card:hover::after {
  content: '' !important;
  position: absolute !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  background: linear-gradient(
    transparent 0%,
    rgba(6, 182, 212, 0.03) 50%,
    transparent 100%
  ) !important;
  animation: scanline 2s linear infinite !important;
  pointer-events: none !important;
}

@keyframes scanline {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(100%); }
}

/* Glowing border animation */
@keyframes borderGlow {
  0%, 100% { border-color: var(--dracanus-border); }
  50% { border-color: var(--dracanus-cyan); }
}

/* Pulsing price on sale items */
.price--on-sale .price__sale {
  animation: priceGlow 2s ease-in-out infinite !important;
}

@keyframes priceGlow {
  0%, 100% { text-shadow: none; }
  50% { text-shadow: 0 0 10px var(--dracanus-cyan); }
}

/* ─────────────────────────────────────────────────────────────
   Typography - Premium Tech Font Stack
   ───────────────────────────────────────────────────────────── */
h1, h2, h3, h4, h5, h6 {
  color: var(--dracanus-light-silver) !important;
  font-weight: 700 !important;
  letter-spacing: -0.3px !important;
}

p, span, div {
  color: var(--dracanus-text-secondary);
}

/* Links */
a {
  color: var(--dracanus-cyan) !important;
  text-decoration: none !important;
  transition: all 0.3s ease !important;
}

a:hover {
  color: var(--dracanus-purple) !important;
  text-shadow: 0 0 8px var(--dracanus-cyan) !important;
}

/* ─────────────────────────────────────────────────────────────
   Scrollbar - Custom Dark Scrollbar
   ───────────────────────────────────────────────────────────── */
::-webkit-scrollbar {
  width: 8px !important;
  height: 8px !important;
}

::-webkit-scrollbar-track {
  background: var(--dracanus-darkest) !important;
}

::-webkit-scrollbar-thumb {
  background: var(--dracanus-charcoal) !important;
  border-radius: 4px !important;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--dracanus-silver) !important;
}

/* ─────────────────────────────────────────────────────────────
   Mobile Responsive Adjustments
   ───────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .product__title, .product-single__title {
    font-size: 1.8rem !important;
  }
  
  .collection-hero__title {
    font-size: 2rem !important;
  }
  
  .btn, button, .button {
    padding: 10px 20px !important;
  }
}

/* ═══════════════════════════════════════════════════════════════
   END DRACANUS AI THEME
   ═══════════════════════════════════════════════════════════════ */
`;

async function applyDracanusTheme() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🐉 DRACANUS AI - PREMIUM THEME INSTALLER');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('Theme Characteristics:');
  console.log('  • Dark, futuristic backgrounds');
  console.log('  • Angular, geometric design elements');
  console.log('  • Metallic silver accents');
  console.log('  • Cyan & purple tech highlights');
  console.log('  • Smooth hover animations');
  console.log('  • Premium AI aesthetic');
  console.log('');

  // Check environment
  if (!process.env.SHOPIFY_STORE_URL || !process.env.SHOPIFY_ADMIN_API_TOKEN) {
    console.error('❌ Missing SHOPIFY_STORE_URL or SHOPIFY_ADMIN_API_TOKEN');
    process.exit(1);
  }

  try {
    // Get current theme
    console.log('📡 Connecting to Shopify...');
    const theme = await getCurrentTheme();
    
    if (!theme) {
      console.error('❌ Could not find active theme');
      process.exit(1);
    }

    console.log(`✅ Found theme: ${theme.name} (ID: ${theme.id})`);
    console.log('');

    // Check for existing custom CSS
    console.log('🔍 Checking for existing custom.css...');
    const existingCSS = await getThemeAsset(theme.id, 'assets/custom.css');
    
    if (existingCSS?.value) {
      console.log('   Found existing custom.css - will append new styles');
    } else {
      console.log('   No existing custom.css - will create new file');
    }

    // Combine existing CSS with Dracanus theme
    const finalCSS = existingCSS?.value 
      ? `${existingCSS.value}\n\n${DRACANUS_CSS}`
      : DRACANUS_CSS;

    // Apply the theme
    console.log('');
    console.log('🎨 Applying Dracanus AI theme...');
    await updateThemeAsset(theme.id, 'assets/custom.css', finalCSS);
    console.log('✅ Custom CSS uploaded successfully!');

    // Verify the theme includes custom.css
    console.log('');
    console.log('🔗 Verifying theme integration...');
    const themeLayout = await getThemeAsset(theme.id, 'layout/theme.liquid');
    
    if (themeLayout?.value && !themeLayout.value.includes('custom.css')) {
      console.log('   ⚠️  Note: Make sure your theme.liquid includes custom.css');
      console.log('   Add this line in the <head> section:');
      console.log('   {{ "custom.css" | asset_url | stylesheet_tag }}');
    } else {
      console.log('   ✅ Theme appears to include custom.css');
    }

    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  🎉 DRACANUS AI THEME APPLIED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('🌐 View your store: https://dracanus-ai.myshopify.com');
    console.log('');
    console.log('Theme Features Applied:');
    console.log('  ✅ Dark futuristic backgrounds');
    console.log('  ✅ Metallic navigation with hover effects');
    console.log('  ✅ Glowing product cards');
    console.log('  ✅ Tech-style buttons with animations');
    console.log('  ✅ Premium typography');
    console.log('  ✅ Cyan & purple accent colors');
    console.log('  ✅ Smooth transitions throughout');
    console.log('');

  } catch (error: any) {
    console.error('❌ Failed to apply theme:', error.message);
    process.exit(1);
  }
}

// Run the installer
applyDracanusTheme();


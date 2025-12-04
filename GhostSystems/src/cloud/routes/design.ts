/**
 * Store Design Agent - API Routes
 * 
 * Endpoints for managing design recommendations and approvals.
 */

import { Router } from 'express';
import {
  runDesignAgent,
  processApproval,
  processRejection,
  getPreview,
  processRevert,
  getAgentStatus,
  getPendingRecommendations,
  getRecommendation,
} from '../../lib/store-design-agent/index.js';

const router = Router();

/**
 * Get agent status and stats
 * GET /api/design/status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await getAgentStatus();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Trigger a manual run of the design agent
 * POST /api/design/run
 */
router.post('/run', async (req, res) => {
  // Verify cron secret for scheduled runs
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  
  // If CRON_SECRET is configured, require valid authorization
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[DesignAgent] Manual run triggered');
    const result = await runDesignAgent();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get pending recommendations
 * GET /api/design/recommendations
 */
router.get('/recommendations', async (req, res) => {
  try {
    const recommendations = await getPendingRecommendations();
    res.json({ recommendations });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a specific recommendation
 * GET /api/design/recommendations/:id
 */
router.get('/recommendations/:id', async (req, res) => {
  try {
    const recommendation = await getRecommendation(req.params.id);
    if (!recommendation) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }
    res.json(recommendation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Approve a recommendation
 * POST /api/design/recommendations/:id/approve
 * GET /api/design/recommendations/:id/approve (for email links)
 */
router.all('/recommendations/:id/approve', async (req, res) => {
  try {
    console.log(`[DesignAgent] Approving recommendation: ${req.params.id}`);
    const result = await processApproval(req.params.id);
    
    if (req.method === 'GET') {
      // Redirect to success page for email links
      if (result.success) {
        res.send(`
          <html>
            <head><title>Approved</title></head>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #059669;">✅ Recommendation Approved</h1>
              <p>The design change has been applied to your store.</p>
              <a href="${process.env.SHOPIFY_STORE_URL}">View Store</a>
            </body>
          </html>
        `);
      } else {
        res.send(`
          <html>
            <head><title>Error</title></head>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #dc2626;">❌ Error</h1>
              <p>${result.error || 'Failed to apply recommendation'}</p>
            </body>
          </html>
        `);
      }
    } else {
      res.json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Reject a recommendation
 * POST /api/design/recommendations/:id/reject
 * GET /api/design/recommendations/:id/reject (for email links)
 */
router.all('/recommendations/:id/reject', async (req, res) => {
  try {
    const reason = req.body?.reason || req.query.reason as string;
    console.log(`[DesignAgent] Rejecting recommendation: ${req.params.id}`);
    const result = await processRejection(req.params.id, reason);
    
    if (req.method === 'GET') {
      res.send(`
        <html>
          <head><title>Rejected</title></head>
          <body style="font-family: sans-serif; text-align: center; padding: 50px;">
            <h1 style="color: #6b7280;">✗ Recommendation Rejected</h1>
            <p>The recommendation has been rejected and won't be applied.</p>
          </body>
        </html>
      `);
    } else {
      res.json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Preview a recommendation
 * GET /api/design/recommendations/:id/preview
 */
router.get('/recommendations/:id/preview', async (req, res) => {
  try {
    console.log(`[DesignAgent] Previewing recommendation: ${req.params.id}`);
    const preview = await getPreview(req.params.id);
    
    if (!preview) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    // Return HTML preview for GET requests
    // Escape all user-controlled content to prevent XSS
    const escapedFiles = preview.affectedFiles.map(f => escapeHtml(f)).join(', ');
    const escapedId = escapeHtml(req.params.id);
    
    res.send(`
      <html>
        <head>
          <title>Preview</title>
          <style>
            body { font-family: sans-serif; padding: 20px; max-width: 1200px; margin: 0 auto; }
            h1 { color: #3b82f6; }
            .diff { display: flex; gap: 20px; }
            .diff > div { flex: 1; }
            pre { background: #1e1e2e; color: #cdd6f4; padding: 15px; border-radius: 8px; overflow-x: auto; }
            .label { font-weight: bold; margin-bottom: 8px; }
            .before .label { color: #dc2626; }
            .after .label { color: #059669; }
            .actions { margin-top: 20px; }
            .btn { padding: 10px 20px; border-radius: 6px; text-decoration: none; margin-right: 10px; }
            .btn-approve { background: #059669; color: white; }
            .btn-reject { background: #6b7280; color: white; }
          </style>
        </head>
        <body>
          <h1>👁 Preview Changes</h1>
          <p><strong>Affected files:</strong> ${escapedFiles}</p>
          
          <div class="diff">
            <div class="before">
              <div class="label">BEFORE</div>
              <pre>${escapeHtml(preview.before.substring(0, 2000))}${preview.before.length > 2000 ? '...' : ''}</pre>
            </div>
            <div class="after">
              <div class="label">AFTER</div>
              <pre>${escapeHtml(preview.after.substring(0, 2000))}${preview.after.length > 2000 ? '...' : ''}</pre>
            </div>
          </div>
          
          <div class="actions">
            <a href="/api/design/recommendations/${escapedId}/approve" class="btn btn-approve">✓ Approve & Apply</a>
            <a href="/api/design/recommendations/${escapedId}/reject" class="btn btn-reject">✗ Reject</a>
          </div>
        </body>
      </html>
    `);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Revert a previously applied change
 * POST /api/design/recommendations/:id/revert
 * GET /api/design/recommendations/:id/revert (for email links)
 */
router.all('/recommendations/:id/revert', async (req, res) => {
  try {
    const backupId = req.params.id; // In this case, ID is the backup ID
    console.log(`[DesignAgent] Reverting change: ${backupId}`);
    const result = await processRevert(backupId);
    
    if (req.method === 'GET') {
      if (result.success) {
        res.send(`
          <html>
            <head><title>Reverted</title></head>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #f59e0b;">🔄 Change Reverted</h1>
              <p>The design change has been reverted to its previous state.</p>
            </body>
          </html>
        `);
      } else {
        res.send(`
          <html>
            <head><title>Error</title></head>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: #dc2626;">❌ Revert Failed</h1>
              <p>${result.error || 'Failed to revert change'}</p>
            </body>
          </html>
        `);
      }
    } else {
      res.json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Apply Dracanus AI theme
 * POST /api/design/apply-theme
 */
router.post('/apply-theme', async (req, res) => {
  try {
    console.log('[DesignAgent] 🐉 Applying Dracanus AI theme...');
    
    // Import theme functions dynamically
    const { getCurrentTheme, updateThemeAsset, getThemeAsset } = await import('../../lib/shopify.js');
    
    const theme = await getCurrentTheme();
    if (!theme) {
      return res.status(500).json({ error: 'Could not find active theme' });
    }
    
    console.log(`[DesignAgent] Found theme: ${theme.name} (ID: ${theme.id})`);
    
    // Dracanus AI CSS Theme
    const DRACANUS_CSS = getDracanusCSS();
    
    // Upload custom CSS file
    console.log('[DesignAgent] Uploading custom.css...');
    await updateThemeAsset(theme.id, 'assets/custom.css', DRACANUS_CSS);
    
    // Now ensure theme.liquid includes the custom.css
    console.log('[DesignAgent] Checking theme.liquid for CSS include...');
    const themeLiquid = await getThemeAsset(theme.id, 'layout/theme.liquid');
    
    if (!themeLiquid?.value) {
      return res.status(500).json({ error: 'Could not read theme.liquid' });
    }
    
    const cssIncludeTag = `{{ 'custom.css' | asset_url | stylesheet_tag }}`;
    
    // Check if already included
    if (!themeLiquid.value.includes('custom.css')) {
      console.log('[DesignAgent] Adding custom.css to theme.liquid...');
      
      // Find </head> and insert before it
      let updatedLiquid = themeLiquid.value;
      
      if (updatedLiquid.includes('</head>')) {
        updatedLiquid = updatedLiquid.replace(
          '</head>',
          `  ${cssIncludeTag}\n  </head>`
        );
      } else if (updatedLiquid.includes('{% endcontent_for_header %}')) {
        // Alternative: add after content_for_header
        updatedLiquid = updatedLiquid.replace(
          '{% endcontent_for_header %}',
          `{% endcontent_for_header %}\n  ${cssIncludeTag}`
        );
      }
      
      await updateThemeAsset(theme.id, 'layout/theme.liquid', updatedLiquid);
      console.log('[DesignAgent] ✅ Added custom.css to theme.liquid');
    } else {
      console.log('[DesignAgent] custom.css already included in theme.liquid');
    }
    
    console.log('[DesignAgent] ✅ Dracanus AI theme applied!');
    
    res.json({ 
      success: true, 
      message: 'Dracanus AI theme applied successfully',
      theme: theme.name,
      cssIncluded: true
    });
  } catch (error: any) {
    console.error('[DesignAgent] Theme application failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get Dracanus AI CSS theme - Premium Dark Design
 */
function getDracanusCSS(): string {
  return `/* ═══════════════════════════════════════════════════════════════
   DRACANUS AI - PREMIUM DARK THEME v2.0
   Matching the Angular Metallic Mockup Design
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

/* ─── GLOBAL RESET ─── */
*, *::before, *::after { box-sizing: border-box; }

html, body {
  background: var(--bg-darkest) !important;
  background-image: 
    radial-gradient(ellipse at 50% 0%, rgba(40,40,45,0.3) 0%, transparent 50%),
    linear-gradient(180deg, #0d0d0d 0%, #101012 50%, #0d0d0d 100%) !important;
  color: var(--text-primary) !important;
  font-family: 'Inter', 'Segoe UI', -apple-system, sans-serif !important;
  min-height: 100vh;
}

/* ─── DARK TEXTURE OVERLAY ─── */
body::before {
  content: '';
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
  opacity: 0.03;
  pointer-events: none;
  z-index: 0;
}

/* ─── ALL SECTIONS DARK ─── */
.shopify-section, section, main, #MainContent, .main-content, .page-width, .template-index, [class*="section"] {
  background: transparent !important;
  position: relative;
  z-index: 1;
}

/* ─── HEADER - FLOATING DARK NAV ─── */
header, .header, .site-header, .header-wrapper, #shopify-section-header, .section-header {
  background: rgba(13,13,13,0.95) !important;
  backdrop-filter: blur(10px) !important;
  border-bottom: 1px solid var(--border-dark) !important;
  box-shadow: 0 4px 30px rgba(0,0,0,0.5) !important;
}

.header__inline-menu, .header-menu, nav, .site-nav {
  background: transparent !important;
}

.header__menu-item, nav a, .site-nav a, .header-menu-item, .list-menu__item {
  color: var(--text-secondary) !important;
  font-weight: 500 !important;
  font-size: 14px !important;
  letter-spacing: 0.5px !important;
  text-transform: uppercase !important;
  padding: 8px 16px !important;
  border-radius: 4px !important;
  transition: all 0.3s ease !important;
  background: transparent !important;
}

.header__menu-item:hover, nav a:hover, .site-nav a:hover, .list-menu__item:hover {
  color: var(--text-primary) !important;
  background: rgba(255,255,255,0.05) !important;
}

/* Logo/Brand */
.header__heading-link, .site-header__logo, h1.header__heading {
  color: var(--text-primary) !important;
  font-weight: 700 !important;
  letter-spacing: 2px !important;
}

/* ─── HERO SECTION - FULL DARK ─── */
.banner, .hero, .slideshow, .image-with-text, [class*="hero"], [class*="banner"], .shopify-section--image-with-text-overlay {
  background: var(--bg-darkest) !important;
  position: relative;
}

.banner__content, .hero__content, .slideshow__content {
  background: transparent !important;
}

.banner__heading, .hero__title, h1, h2.banner__heading {
  color: var(--text-primary) !important;
  font-weight: 800 !important;
  text-transform: uppercase !important;
  letter-spacing: 3px !important;
  text-shadow: 0 2px 20px rgba(0,0,0,0.8) !important;
}

/* ─── PRODUCT CARDS - DARK METALLIC ─── */
.product-card, .card, .product-item, .grid__item .card, .card-wrapper, .product-card-wrapper {
  background: var(--bg-card) !important;
  border: 1px solid var(--border-dark) !important;
  border-radius: 8px !important;
  overflow: hidden !important;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important;
}

.product-card:hover, .card:hover, .card-wrapper:hover {
  transform: translateY(-5px) scale(1.02) !important;
  border-color: var(--border-metallic) !important;
  box-shadow: 0 8px 40px rgba(0,0,0,0.6), 0 0 20px rgba(100,100,110,0.1) !important;
}

.card__inner, .card__content, .card-information {
  background: var(--bg-card) !important;
  padding: 16px !important;
}

.card__heading, .product-card__title, .card__heading a, h3.card__heading a {
  color: var(--text-primary) !important;
  font-weight: 600 !important;
  font-size: 16px !important;
  text-decoration: none !important;
}

.card__information, .product-card__info {
  background: var(--bg-card) !important;
}

/* Product Images */
.card__media, .product-card__image, .media {
  background: var(--bg-surface) !important;
  border-bottom: 1px solid var(--border-dark) !important;
}

/* ─── PRICES ─── */
.price, .product-price, .price__regular, .money, .price-item {
  color: var(--accent-silver) !important;
  font-weight: 600 !important;
  font-size: 18px !important;
}

/* ─── BUTTONS - DARK METALLIC ─── */
.btn, button, .button, .shopify-payment-button__button, input[type="submit"], .product-form__submit {
  background: linear-gradient(135deg, #2a2a2e 0%, #3a3a3f 50%, #2a2a2e 100%) !important;
  color: var(--text-primary) !important;
  border: 1px solid var(--border-metallic) !important;
  border-radius: 4px !important;
  font-weight: 600 !important;
  font-size: 14px !important;
  letter-spacing: 1px !important;
  text-transform: uppercase !important;
  padding: 12px 24px !important;
  transition: all 0.3s ease !important;
  box-shadow: 0 2px 10px rgba(0,0,0,0.3) !important;
}

.btn:hover, button:hover, .button:hover {
  background: linear-gradient(135deg, #3a3a3f 0%, #4a4a4f 50%, #3a3a3f 100%) !important;
  border-color: var(--accent-silver) !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important;
}

/* Primary buttons */
.btn--primary, .shopify-payment-button__button--unbranded {
  background: linear-gradient(135deg, #4a4a4f 0%, #5a5a5f 50%, #4a4a4f 100%) !important;
  border: none !important;
}

/* ─── SECTION HEADINGS ─── */
h1, h2, h3, h4, h5, h6, .title, .section-header__title {
  color: var(--text-primary) !important;
  font-weight: 700 !important;
  letter-spacing: 1px !important;
}

h2, .section-header__title, .title--primary {
  text-align: center !important;
  font-size: 28px !important;
  text-transform: uppercase !important;
  letter-spacing: 3px !important;
  margin-bottom: 40px !important;
}

/* ─── FEATURED PRODUCTS SECTION ─── */
.featured-collection, .collection-list, [class*="featured"] {
  background: transparent !important;
  padding: 60px 0 !important;
}

/* ─── FOOTER - DARK PREMIUM ─── */
footer, .footer, .site-footer, #shopify-section-footer, .footer-section {
  background: var(--bg-dark) !important;
  border-top: 1px solid var(--border-dark) !important;
  color: var(--text-secondary) !important;
  padding: 60px 0 30px !important;
}

.footer__title, .footer-block__heading {
  color: var(--text-primary) !important;
  font-weight: 600 !important;
  text-transform: uppercase !important;
  letter-spacing: 1px !important;
  margin-bottom: 20px !important;
}

footer a, .footer a, .footer-menu a {
  color: var(--text-secondary) !important;
  transition: color 0.3s ease !important;
}

footer a:hover, .footer a:hover {
  color: var(--text-primary) !important;
}

/* Newsletter */
.newsletter, .footer__newsletter {
  background: transparent !important;
}

.newsletter input, .footer input[type="email"] {
  background: var(--bg-surface) !important;
  border: 1px solid var(--border-dark) !important;
  color: var(--text-primary) !important;
  padding: 12px 16px !important;
}

/* ─── INPUTS & FORMS ─── */
input, textarea, select, .field__input {
  background: var(--bg-surface) !important;
  border: 1px solid var(--border-dark) !important;
  color: var(--text-primary) !important;
  border-radius: 4px !important;
  padding: 12px 16px !important;
}

input:focus, textarea:focus, select:focus {
  border-color: var(--border-metallic) !important;
  outline: none !important;
  box-shadow: 0 0 0 2px rgba(100,100,110,0.2) !important;
}

/* ─── LINKS ─── */
a {
  color: var(--text-secondary) !important;
  text-decoration: none !important;
  transition: color 0.3s ease !important;
}

a:hover {
  color: var(--text-primary) !important;
}

/* ─── PRODUCT PAGE ─── */
.product, .product-single, .product__info-wrapper {
  background: transparent !important;
}

.product__title {
  font-size: 32px !important;
  font-weight: 700 !important;
  letter-spacing: 1px !important;
}

/* ─── COLLECTION PAGE ─── */
.collection, .collection-hero {
  background: transparent !important;
}

.collection-hero__title {
  font-size: 42px !important;
  text-transform: uppercase !important;
  letter-spacing: 4px !important;
}

/* ─── CART ─── */
.cart, .cart-drawer, .cart__contents, .drawer {
  background: var(--bg-dark) !important;
  border-left: 1px solid var(--border-dark) !important;
}

.cart-item, .cart__item {
  border-bottom: 1px solid var(--border-dark) !important;
}

/* ─── ANNOUNCEMENT BAR ─── */
.announcement-bar {
  background: var(--bg-dark) !important;
  border-bottom: 1px solid var(--border-dark) !important;
  color: var(--text-secondary) !important;
}

/* ─── SCROLLBAR ─── */
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: var(--bg-darkest); }
::-webkit-scrollbar-thumb { background: var(--border-metallic); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--accent-silver); }

/* ─── REMOVE UNWANTED BACKGROUNDS ─── */
.color-background-1, .color-background-2, .background-primary, .background-secondary,
[style*="background"], .gradient {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
}

/* ─── IMAGE PLACEHOLDERS ─── */
.placeholder-svg, svg.placeholder {
  background: var(--bg-surface) !important;
  fill: var(--text-muted) !important;
}

/* ─── MOBILE MENU ─── */
.menu-drawer, .mobile-nav {
  background: var(--bg-dark) !important;
}

.menu-drawer__menu-item {
  color: var(--text-secondary) !important;
  border-bottom: 1px solid var(--border-dark) !important;
}

/* ─── LOADING STATES ─── */
.loading-overlay {
  background: var(--bg-darkest) !important;
}

/* ═══════════════════════════════════════════════════════════════ */`;
}

/**
 * Helper to escape HTML
 */
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default router;


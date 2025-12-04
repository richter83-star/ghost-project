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
    
    console.log(`[DesignAgent] Found theme: ${theme.name}`);
    
    // Dracanus AI CSS Theme
    const DRACANUS_CSS = getDracanusCSS();
    
    // Get existing CSS
    const existingCSS = await getThemeAsset(theme.id, 'assets/custom.css');
    const finalCSS = existingCSS?.value 
      ? existingCSS.value + '\\n\\n' + DRACANUS_CSS
      : DRACANUS_CSS;
    
    // Apply theme
    await updateThemeAsset(theme.id, 'assets/custom.css', finalCSS);
    
    console.log('[DesignAgent] ✅ Dracanus AI theme applied!');
    
    res.json({ 
      success: true, 
      message: 'Dracanus AI theme applied successfully',
      theme: theme.name 
    });
  } catch (error: any) {
    console.error('[DesignAgent] Theme application failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get Dracanus AI CSS theme
 */
function getDracanusCSS(): string {
  return \`
/*
 * DRACANUS AI - PREMIUM DARK THEME
 * Futuristic • Angular • Metallic • AI-Powered
 */

:root {
  --dracanus-darkest: #0a0a0f;
  --dracanus-dark: #121218;
  --dracanus-surface: #1a1a24;
  --dracanus-slate: #1e2530;
  --dracanus-charcoal: #2d3748;
  --dracanus-silver: #9ca3af;
  --dracanus-light-silver: #d1d5db;
  --dracanus-cyan: #06b6d4;
  --dracanus-purple: #8b5cf6;
  --dracanus-text: #f3f4f6;
  --dracanus-text-secondary: #9ca3af;
  --dracanus-border: #2d3748;
  --dracanus-glow: 0 0 20px #06b6d440;
  --dracanus-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
}

html, body {
  background: var(--dracanus-darkest) !important;
  color: var(--dracanus-text) !important;
  font-family: 'Inter', -apple-system, sans-serif !important;
}

.main-content, main, #MainContent, .shopify-section {
  background: var(--dracanus-darkest) !important;
}

header, .header, .site-header, .header-wrapper, #shopify-section-header {
  background: linear-gradient(135deg, #0a0a0f 0%, #121218 50%, #1e2530 100%) !important;
  border-bottom: 1px solid var(--dracanus-border) !important;
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.5) !important;
}

.header__menu-item, nav a, .site-nav a, .header-menu-item {
  color: var(--dracanus-silver) !important;
  font-weight: 500 !important;
  letter-spacing: 0.5px !important;
  text-transform: uppercase !important;
  font-size: 13px !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

.header__menu-item:hover, nav a:hover, .site-nav a:hover {
  color: var(--dracanus-cyan) !important;
  text-shadow: 0 0 10px var(--dracanus-cyan) !important;
}

.product-card, .card, .product-item, .grid__item .card {
  background: var(--dracanus-surface) !important;
  border: 1px solid var(--dracanus-border) !important;
  border-radius: 4px !important;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

.product-card:hover, .card:hover {
  transform: translateY(-8px) !important;
  border-color: var(--dracanus-cyan) !important;
  box-shadow: var(--dracanus-glow), var(--dracanus-shadow) !important;
}

.product-card__title, .card__heading, .product-title, h3.card__heading a {
  color: var(--dracanus-light-silver) !important;
  font-weight: 600 !important;
}

.price, .product-price, .price__regular, .money {
  color: var(--dracanus-cyan) !important;
  font-weight: 700 !important;
}

.btn, button, .button, .shopify-payment-button__button, input[type="submit"] {
  background: linear-gradient(135deg, #1e2530, #2d3748) !important;
  color: var(--dracanus-light-silver) !important;
  border: 1px solid var(--dracanus-silver) !important;
  border-radius: 2px !important;
  font-weight: 600 !important;
  letter-spacing: 1px !important;
  text-transform: uppercase !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

.btn:hover, button:hover, .button:hover {
  background: linear-gradient(135deg, #2d3748, #06b6d4) !important;
  border-color: var(--dracanus-cyan) !important;
  box-shadow: var(--dracanus-glow) !important;
  transform: translateY(-2px) !important;
}

.btn--primary, .product-form__submit, .cart__submit {
  background: linear-gradient(135deg, #06b6d4, #8b5cf6) !important;
  border: none !important;
  color: white !important;
}

.btn--primary:hover, .product-form__submit:hover {
  background: linear-gradient(135deg, #8b5cf6, #06b6d4) !important;
  box-shadow: 0 0 30px var(--dracanus-cyan) !important;
}

footer, .footer, .site-footer, #shopify-section-footer {
  background: var(--dracanus-darkest) !important;
  border-top: 1px solid var(--dracanus-border) !important;
}

footer a, .footer a {
  color: var(--dracanus-silver) !important;
}

footer a:hover, .footer a:hover {
  color: var(--dracanus-cyan) !important;
}

.product__title, .product-single__title {
  color: var(--dracanus-light-silver) !important;
  font-size: 2.5rem !important;
  font-weight: 700 !important;
}

.collection-hero {
  background: linear-gradient(135deg, #0a0a0f 0%, #121218 50%, #1e2530 100%) !important;
}

.collection-hero__title {
  color: var(--dracanus-light-silver) !important;
  font-size: 3rem !important;
  font-weight: 800 !important;
  text-transform: uppercase !important;
}

input, textarea, select, .field__input {
  background: var(--dracanus-surface) !important;
  border: 1px solid var(--dracanus-border) !important;
  color: var(--dracanus-text) !important;
  border-radius: 2px !important;
}

input:focus, textarea:focus, select:focus {
  border-color: var(--dracanus-cyan) !important;
  box-shadow: 0 0 10px #06b6d440 !important;
}

h1, h2, h3, h4, h5, h6 {
  color: var(--dracanus-light-silver) !important;
  font-weight: 700 !important;
}

a {
  color: var(--dracanus-cyan) !important;
  transition: all 0.3s ease !important;
}

a:hover {
  color: var(--dracanus-purple) !important;
  text-shadow: 0 0 8px var(--dracanus-cyan) !important;
}

::-webkit-scrollbar {
  width: 8px !important;
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

.announcement-bar {
  background: linear-gradient(90deg, #0a0a0f, #1e2530, #0a0a0f) !important;
  border-bottom: 1px solid #06b6d440 !important;
  color: var(--dracanus-silver) !important;
}
\`;
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


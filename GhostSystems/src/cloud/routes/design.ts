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
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Allow if no CRON_SECRET is set (for testing)
    if (cronSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
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


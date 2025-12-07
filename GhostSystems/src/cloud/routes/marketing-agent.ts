/**
 * Marketing Agent - API Routes
 * 
 * Endpoints for managing marketing recommendations and campaigns.
 */

import { Router } from 'express';
import {
  runMarketingAgent,
  getAgentStatus,
  getPendingRecommendations,
  getRecommendation,
  approveRecommendation,
  rejectRecommendation,
} from '../../lib/marketing-agent/index.js';
import { executeCampaign } from '../../lib/marketing-agent/campaign-executor.js';
import { getActiveCampaigns } from '../../lib/marketing-agent/campaign-executor.js';
import { getLearningInsights } from '../../lib/marketing-agent/learning.js';
import { getAvailablePlatforms, getCredentialStatus } from '../../lib/marketing-agent/credentials.js';

const router = Router();

/**
 * Get agent status and stats
 * GET /api/marketing-agent/status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await getAgentStatus();
    const availablePlatforms = await getAvailablePlatforms();
    const credentialStatus = await getCredentialStatus();
    
    res.json({
      ...status,
      availablePlatforms,
      credentialStatus,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Trigger a manual run of the marketing agent
 * POST /api/marketing-agent/run
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
    console.log('[MarketingAgent] Manual run triggered');
    const result = await runMarketingAgent();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get pending recommendations
 * GET /api/marketing-agent/recommendations
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
 * GET /api/marketing-agent/recommendations/:id
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
 * POST /api/marketing-agent/recommendations/:id/approve
 * GET /api/marketing-agent/recommendations/:id/approve (for email links)
 */
router.all('/recommendations/:id/approve', async (req, res) => {
  try {
    console.log(`[MarketingAgent] Approving recommendation: ${req.params.id}`);
    const result = await approveRecommendation(req.params.id);
    
    if (req.method === 'GET') {
      // Redirect to success page for email links
      if (result) {
        res.send(`
          <html>
            <head><title>Recommendation Approved</title></head>
            <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
              <h1>✅ Recommendation Approved</h1>
              <p>The marketing campaign will be executed automatically.</p>
              <p><a href="${process.env.APP_URL || ''}/api/marketing-agent/status">View Status</a></p>
            </body>
          </html>
        `);
      } else {
        res.status(400).send('Failed to approve recommendation');
      }
    } else {
      res.json({ success: result });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Reject a recommendation
 * POST /api/marketing-agent/recommendations/:id/reject
 * GET /api/marketing-agent/recommendations/:id/reject (for email links)
 */
router.all('/recommendations/:id/reject', async (req, res) => {
  try {
    const reason = req.body?.reason || req.query?.reason as string;
    console.log(`[MarketingAgent] Rejecting recommendation: ${req.params.id}`);
    const result = await rejectRecommendation(req.params.id, reason);
    
    if (req.method === 'GET') {
      if (result) {
        res.send(`
          <html>
            <head><title>Recommendation Rejected</title></head>
            <body style="font-family: Arial, sans-serif; padding: 40px; text-align: center;">
              <h1>❌ Recommendation Rejected</h1>
              <p>Your feedback helps improve future recommendations.</p>
              <p><a href="${process.env.APP_URL || ''}/api/marketing-agent/status">View Status</a></p>
            </body>
          </html>
        `);
      } else {
        res.status(400).send('Failed to reject recommendation');
      }
    } else {
      res.json({ success: result });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Execute a campaign manually
 * POST /api/marketing-agent/campaigns/:id/execute
 */
router.post('/campaigns/:id/execute', async (req, res) => {
  try {
    const recommendation = await getRecommendation(req.params.id);
    if (!recommendation) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    if (recommendation.status !== 'approved') {
      return res.status(400).json({ error: 'Campaign must be approved before execution' });
    }

    const result = await executeCampaign(recommendation);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get active campaigns
 * GET /api/marketing-agent/campaigns
 */
router.get('/campaigns', async (req, res) => {
  try {
    const campaigns = await getActiveCampaigns();
    res.json({ campaigns });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get performance metrics
 * GET /api/marketing-agent/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();
    
    // Get all recommendations for analysis
    const allRecs = await db.collection('marketing_recommendations')
      .orderBy('createdAt', 'desc')
      .limit(1000)
      .get();
    
    const recommendations = allRecs.docs.map(doc => doc.data());
    
    // Calculate metrics
    const total = recommendations.length;
    const byStatus = {
      pending: recommendations.filter((r: any) => r.status === 'pending').length,
      approved: recommendations.filter((r: any) => r.status === 'approved').length,
      rejected: recommendations.filter((r: any) => r.status === 'rejected').length,
      executing: recommendations.filter((r: any) => r.status === 'executing').length,
      completed: recommendations.filter((r: any) => r.status === 'completed').length,
    };
    
    const byType: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let totalImpact = 0;
    let totalConfidence = 0;
    let impactCount = 0;
    let confidenceCount = 0;
    let totalExpectedRevenue = 0;
    let totalActualRevenue = 0;
    
    recommendations.forEach((rec: any) => {
      // By type
      const type = rec.type || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
      
      // By priority
      const priority = rec.priority || 'unknown';
      byPriority[priority] = (byPriority[priority] || 0) + 1;
      
      // Impact and confidence
      if (rec.metrics?.expectedImpact) {
        totalImpact += rec.metrics.expectedImpact;
        impactCount++;
      }
      if (rec.metrics?.confidence) {
        totalConfidence += rec.metrics.confidence;
        confidenceCount++;
      }
      if (rec.metrics?.expectedRevenue) {
        totalExpectedRevenue += rec.metrics.expectedRevenue;
      }
      if (rec.results?.actualRevenue) {
        totalActualRevenue += rec.results.actualRevenue;
      }
    });
    
    const averageImpact = impactCount > 0 ? totalImpact / impactCount : 0;
    const averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;
    
    // Calculate ROI
    const totalROI = totalExpectedRevenue > 0 
      ? ((totalActualRevenue - totalExpectedRevenue) / totalExpectedRevenue) * 100 
      : 0;
    
    // Get learning insights
    const { getLearningInsights } = await import('../../lib/marketing-agent/learning.js');
    const learningInsights = await getLearningInsights();
    
    res.json({
      summary: {
        total,
        byStatus,
        byType,
        byPriority,
        averageImpact: Math.round(averageImpact * 10) / 10,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        totalExpectedRevenue: Math.round(totalExpectedRevenue * 100) / 100,
        totalActualRevenue: Math.round(totalActualRevenue * 100) / 100,
        totalROI: Math.round(totalROI * 10) / 10,
      },
      learning: learningInsights,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;


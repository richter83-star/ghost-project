/**
 * Dashboard API Routes
 * 
 * Aggregated endpoints for mobile dashboard to control and monitor all AI agents.
 */

import { Router } from 'express';
import { getFirestore } from 'firebase-admin/firestore';

const router = Router();

/**
 * Simple authentication middleware
 */
function authenticate(req: any, res: any, next: any) {
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  const dashboardKey = process.env.DASHBOARD_API_KEY;

  // If no key is configured, allow access (for development)
  if (!dashboardKey) {
    return next();
  }

  if (!apiKey || apiKey !== dashboardKey) {
    return res.status(401).json({ error: 'Unauthorized. Provide X-API-Key header or ?apiKey= query param.' });
  }

  next();
}

// Apply authentication to all routes
router.use(authenticate);

/**
 * Get overall system status and all agent statuses
 * GET /api/dashboard/status
 */
router.get('/status', async (req, res) => {
  try {
    const systemStatus = {
      system: 'Ghost Fleet Controller',
      status: 'online',
      timestamp: new Date().toISOString(),
    };

    // Get Adaptive AI status
    let adaptiveAI: any = { enabled: false };
    if (process.env.ENABLE_ADAPTIVE_AI === 'true') {
      try {
        const { getAdaptiveAIMonitoring } = await import('../../integrations/adaptive-ai/listener.js');
        const monitoring = getAdaptiveAIMonitoring();
        const lastGen = monitoring.lastCycle?.timestamp
          ? (monitoring.lastCycle.timestamp instanceof Date
              ? monitoring.lastCycle.timestamp.toISOString()
              : new Date(monitoring.lastCycle.timestamp).toISOString())
          : null;

        adaptiveAI = {
          enabled: true,
          isActive: monitoring.isActive,
          lastGeneration: lastGen,
          totalCycles: monitoring.totalCycles,
          successRate: monitoring.successRate,
          totalProductsGenerated: monitoring.totalProductsGenerated,
          averageProductsPerCycle: monitoring.averageProductsPerCycle,
          lastCycleProducts: monitoring.lastCycle?.productsCreated?.length || 0,
        };
      } catch (error: any) {
        adaptiveAI = { enabled: true, error: error.message };
      }
    }

    // Get Store Design Agent status
    let storeDesign: any = { enabled: false };
    if (process.env.ENABLE_STORE_DESIGN_AGENT === 'true') {
      try {
        const { getAgentStatus } = await import('../../lib/store-design-agent/index.js');
        storeDesign = await getAgentStatus();
        storeDesign.enabled = true;
      } catch (error: any) {
        storeDesign = { enabled: true, error: error.message };
      }
    }

    // Get Marketing Agent status
    let marketing: any = { enabled: false };
    if (process.env.ENABLE_MARKETING_AGENT === 'true') {
      try {
        const { getAgentStatus } = await import('../../lib/marketing-agent/index.js');
        marketing = await getAgentStatus();
        marketing.enabled = true;
      } catch (error: any) {
        marketing = { enabled: true, error: error.message };
      }
    }

    res.json({
      ...systemStatus,
      agents: {
        adaptiveAI,
        storeDesign,
        marketing,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get list of all agents with their current state
 * GET /api/dashboard/agents
 */
router.get('/agents', async (req, res) => {
  try {
    const agents = [];

    // Adaptive AI
    if (process.env.ENABLE_ADAPTIVE_AI === 'true') {
      try {
        const { getAdaptiveAIMonitoring } = await import('../../integrations/adaptive-ai/listener.js');
        const status = getAdaptiveAIMonitoring();
        const lastRun = status.lastCycle?.timestamp 
          ? (status.lastCycle.timestamp instanceof Date 
              ? status.lastCycle.timestamp.toISOString() 
              : new Date(status.lastCycle.timestamp).toISOString())
          : null;

        agents.push({
          id: 'adaptiveAI',
          name: 'Adaptive AI',
          description: 'Intelligent product generation based on market data',
          enabled: true,
          status: status.lastCycle ? 'active' : 'idle',
          lastRun,
          stats: {
            productsGenerated: status.totalProductsGenerated,
            lastCycleProducts: status.lastCycle?.productsCreated?.length || 0,
            totalCycles: status.totalCycles,
            successRate: status.successRate,
          },
        });
      } catch (error: any) {
        agents.push({
          id: 'adaptiveAI',
          name: 'Adaptive AI',
          enabled: true,
          status: 'error',
          error: error.message,
        });
      }
    } else {
      agents.push({
        id: 'adaptiveAI',
        name: 'Adaptive AI',
        enabled: false,
        status: 'disabled',
      });
    }

    // Store Design Agent
    if (process.env.ENABLE_STORE_DESIGN_AGENT === 'true') {
      try {
        const { getAgentStatus } = await import('../../lib/store-design-agent/index.js');
        const status = await getAgentStatus();
        agents.push({
          id: 'storeDesign',
          name: 'Store Design Agent',
          description: 'AI-powered store design optimization',
          enabled: true,
          status: status.pendingRecommendations > 0 ? 'active' : 'idle',
          lastRun: status.lastRun,
          stats: {
            pending: status.pendingRecommendations,
            approved: status.approvedRecommendations,
            applied: status.appliedRecommendations,
            rejected: status.rejectedRecommendations,
            avgImpact: status.avgImpact,
          },
        });
      } catch (error: any) {
        agents.push({
          id: 'storeDesign',
          name: 'Store Design Agent',
          enabled: true,
          status: 'error',
          error: error.message,
        });
      }
    } else {
      agents.push({
        id: 'storeDesign',
        name: 'Store Design Agent',
        enabled: false,
        status: 'disabled',
      });
    }

    // Marketing Agent
    if (process.env.ENABLE_MARKETING_AGENT === 'true') {
      try {
        const { getAgentStatus } = await import('../../lib/marketing-agent/index.js');
        const status = await getAgentStatus();
        agents.push({
          id: 'marketing',
          name: 'Marketing Agent',
          description: 'Autonomous marketing strategy and campaign execution',
          enabled: true,
          status: status.activeCampaigns > 0 ? 'active' : 'idle',
          lastRun: status.lastRun,
          stats: {
            pending: status.pendingRecommendations,
            approved: status.approvedRecommendations,
            completed: status.completedRecommendations,
            activeCampaigns: status.activeCampaigns,
            successRate: status.successRate,
          },
        });
      } catch (error: any) {
        agents.push({
          id: 'marketing',
          name: 'Marketing Agent',
          enabled: true,
          status: 'error',
          error: error.message,
        });
      }
    } else {
      agents.push({
        id: 'marketing',
        name: 'Marketing Agent',
        enabled: false,
        status: 'disabled',
      });
    }

    res.json({ agents });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get all pending recommendations from all agents
 * GET /api/dashboard/recommendations
 */
router.get('/recommendations', async (req, res) => {
  try {
    const recommendations: any[] = [];

    // Get Store Design recommendations
    if (process.env.ENABLE_STORE_DESIGN_AGENT === 'true') {
      try {
        const { getPendingRecommendations } = await import('../../lib/store-design-agent/index.js');
        const designRecs = await getPendingRecommendations();
        recommendations.push(...designRecs.map((rec: any) => ({
          ...rec,
          agent: 'storeDesign',
          agentName: 'Store Design Agent',
        })));
      } catch (error: any) {
        console.error('[Dashboard] Failed to get design recommendations:', error.message);
      }
    }

    // Get Marketing recommendations
    if (process.env.ENABLE_MARKETING_AGENT === 'true') {
      try {
        const { getPendingRecommendations } = await import('../../lib/marketing-agent/index.js');
        const marketingRecs = await getPendingRecommendations();
        recommendations.push(...marketingRecs.map((rec: any) => ({
          ...rec,
          agent: 'marketing',
          agentName: 'Marketing Agent',
        })));
      } catch (error: any) {
        console.error('[Dashboard] Failed to get marketing recommendations:', error.message);
      }
    }

    // Sort by priority and date
    recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    res.json({ recommendations, total: recommendations.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get recent outputs from all agents
 * GET /api/dashboard/outputs
 */
router.get('/outputs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const outputs: any[] = [];

    const db = getFirestore();

    // Get Adaptive AI products (recent)
    if (process.env.ENABLE_ADAPTIVE_AI === 'true') {
      try {
        const productsSnapshot = await db.collection('products')
          .where('source', '==', 'adaptive_ai')
          .orderBy('createdAt', 'desc')
          .limit(20)
          .get();

        productsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          outputs.push({
            id: doc.id,
            agent: 'adaptiveAI',
            agentName: 'Adaptive AI',
            type: 'product',
            title: data.title,
            status: data.status,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
            metadata: {
              productType: data.productType,
              price: data.price,
              niche: data.niche,
            },
          });
        });
      } catch (error: any) {
        console.error('[Dashboard] Failed to get Adaptive AI products:', error.message);
      }
    }

    // Get Store Design applied recommendations
    if (process.env.ENABLE_STORE_DESIGN_AGENT === 'true') {
      try {
        const designSnapshot = await db.collection('store_design_recommendations')
          .where('status', 'in', ['applied', 'completed'])
          .orderBy('createdAt', 'desc')
          .limit(20)
          .get();

        designSnapshot.docs.forEach(doc => {
          const data = doc.data();
          outputs.push({
            id: doc.id,
            agent: 'storeDesign',
            agentName: 'Store Design Agent',
            type: 'design_change',
            title: data.title,
            status: data.status,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
            metadata: {
              type: data.type,
              impact: data.metrics?.estimatedImpact,
            },
          });
        });
      } catch (error: any) {
        console.error('[Dashboard] Failed to get design outputs:', error.message);
      }
    }

    // Get Marketing campaigns
    if (process.env.ENABLE_MARKETING_AGENT === 'true') {
      try {
        const campaignsSnapshot = await db.collection('marketing_campaigns')
          .where('status', 'in', ['completed', 'running'])
          .orderBy('startedAt', 'desc')
          .limit(20)
          .get();

        campaignsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          outputs.push({
            id: doc.id,
            agent: 'marketing',
            agentName: 'Marketing Agent',
            type: 'campaign',
            title: `Campaign: ${data.type}`,
            status: data.status,
            createdAt: data.startedAt?.toDate?.()?.toISOString() || data.startedAt,
            metadata: {
              type: data.type,
              metrics: data.metrics,
            },
          });
        });
      } catch (error: any) {
        console.error('[Dashboard] Failed to get marketing campaigns:', error.message);
      }
    }

    // Sort by date (newest first)
    outputs.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    res.json({ outputs: outputs.slice(0, limit), total: outputs.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get recent logs from all agents
 * GET /api/dashboard/logs
 */
router.get('/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const agentFilter = req.query.agent as string | undefined;
    const levelFilter = req.query.level as string | undefined;

    // Note: In a production system, you'd want to store logs in a database
    // For now, we'll return a message that logs should be viewed in Render logs
    // In the future, this could integrate with a logging service

    res.json({
      message: 'Logs are available in Render dashboard logs. Real-time log streaming coming soon.',
      logs: [],
      filters: {
        agent: agentFilter,
        level: levelFilter,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get combined metrics dashboard
 * GET /api/dashboard/metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics: any = {
      adaptiveAI: {},
      storeDesign: {},
      marketing: {},
      overall: {},
    };

    const db = getFirestore();

    // Adaptive AI metrics
    if (process.env.ENABLE_ADAPTIVE_AI === 'true') {
      try {
        const productsSnapshot = await db.collection('products')
          .where('source', '==', 'adaptive_ai')
          .get();

        const products = productsSnapshot.docs.map(doc => doc.data());
        metrics.adaptiveAI = {
          totalProducts: products.length,
          published: products.filter((p: any) => p.status === 'published').length,
          pending: products.filter((p: any) => p.status === 'pending').length,
          avgPrice: products.length > 0
            ? products.reduce((sum: number, p: any) => sum + (parseFloat(p.price) || 0), 0) / products.length
            : 0,
        };
      } catch (error: any) {
        console.error('[Dashboard] Failed to get Adaptive AI metrics:', error.message);
      }
    }

    // Store Design metrics
    if (process.env.ENABLE_STORE_DESIGN_AGENT === 'true') {
      try {
        const { getAgentStatus } = await import('../../lib/store-design-agent/index.js');
        const status = await getAgentStatus();
        metrics.storeDesign = {
          pending: status.pendingRecommendations,
          approved: status.approvedRecommendations,
          applied: status.appliedRecommendations,
          rejected: status.rejectedRecommendations,
          avgImpact: status.avgImpact,
          successRate: status.approvedRecommendations + status.rejectedRecommendations > 0
            ? (status.approvedRecommendations / (status.approvedRecommendations + status.rejectedRecommendations)) * 100
            : 0,
        };
      } catch (error: any) {
        console.error('[Dashboard] Failed to get Store Design metrics:', error.message);
      }
    }

    // Marketing metrics
    if (process.env.ENABLE_MARKETING_AGENT === 'true') {
      try {
        const { getAgentStatus } = await import('../../lib/marketing-agent/index.js');
        const status = await getAgentStatus();
        metrics.marketing = {
          pending: status.pendingRecommendations,
          approved: status.approvedRecommendations,
          completed: status.completedRecommendations,
          activeCampaigns: status.activeCampaigns,
          successRate: status.successRate,
          avgConfidence: status.averageConfidence,
        };
      } catch (error: any) {
        console.error('[Dashboard] Failed to get Marketing metrics:', error.message);
      }
    }

    // Overall metrics
    metrics.overall = {
      totalAgents: 3,
      activeAgents: [
        process.env.ENABLE_ADAPTIVE_AI === 'true',
        process.env.ENABLE_STORE_DESIGN_AGENT === 'true',
        process.env.ENABLE_MARKETING_AGENT === 'true',
      ].filter(Boolean).length,
      totalRecommendations: (metrics.storeDesign.pending || 0) + (metrics.marketing.pending || 0),
      totalProducts: metrics.adaptiveAI.totalProducts || 0,
    };

    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get a specific recommendation by ID
 * GET /api/dashboard/recommendations/:id
 */
router.get('/recommendations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const agent = req.query.agent as string; // 'storeDesign' or 'marketing'

    if (!agent) {
      return res.status(400).json({ error: 'Agent parameter required (storeDesign or marketing)' });
    }

    let recommendation = null;

    if (agent === 'storeDesign') {
      const { getRecommendation } = await import('../../lib/store-design-agent/index.js');
      recommendation = await getRecommendation(id);
    } else if (agent === 'marketing') {
      const { getRecommendation } = await import('../../lib/marketing-agent/index.js');
      recommendation = await getRecommendation(id);
    } else {
      return res.status(400).json({ error: 'Invalid agent. Use storeDesign or marketing' });
    }

    if (!recommendation) {
      return res.status(404).json({ error: 'Recommendation not found' });
    }

    res.json({ ...recommendation, agent, agentName: agent === 'storeDesign' ? 'Store Design Agent' : 'Marketing Agent' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Approve a recommendation
 * POST /api/dashboard/recommendations/:id/approve
 */
router.post('/recommendations/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const agent = req.body.agent || req.query.agent as string;

    if (!agent) {
      return res.status(400).json({ error: 'Agent parameter required (storeDesign or marketing)' });
    }

    let result = false;

    if (agent === 'storeDesign') {
      const { approveRecommendation } = await import('../../lib/store-design-agent/index.js');
      result = await approveRecommendation(id);
    } else if (agent === 'marketing') {
      const { approveRecommendation } = await import('../../lib/marketing-agent/index.js');
      result = await approveRecommendation(id);
    } else {
      return res.status(400).json({ error: 'Invalid agent' });
    }

    res.json({ success: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Reject a recommendation
 * POST /api/dashboard/recommendations/:id/reject
 */
router.post('/recommendations/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const agent = req.body.agent || req.query.agent as string;
    const reason = req.body.reason;

    if (!agent) {
      return res.status(400).json({ error: 'Agent parameter required (storeDesign or marketing)' });
    }

    let result = false;

    if (agent === 'storeDesign') {
      const { rejectRecommendation } = await import('../../lib/store-design-agent/index.js');
      result = await rejectRecommendation(id, reason);
    } else if (agent === 'marketing') {
      const { rejectRecommendation } = await import('../../lib/marketing-agent/index.js');
      result = await rejectRecommendation(id, reason);
    } else {
      return res.status(400).json({ error: 'Invalid agent' });
    }

    res.json({ success: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Trigger manual agent run
 * POST /api/dashboard/agents/:agentId/run
 */
router.post('/agents/:agentId/run', async (req, res) => {
  try {
    const { agentId } = req.params;

    let result: any;

    if (agentId === 'adaptiveAI') {
      const { runAdaptiveGeneration } = await import('../../integrations/adaptive-ai/listener.js');
      await runAdaptiveGeneration();
      result = { success: true, message: 'Adaptive AI generation triggered' };
    } else if (agentId === 'storeDesign') {
      const { runDesignAgent } = await import('../../lib/store-design-agent/index.js');
      result = await runDesignAgent();
    } else if (agentId === 'marketing') {
      const { runMarketingAgent } = await import('../../lib/marketing-agent/index.js');
      result = await runMarketingAgent();
    } else {
      return res.status(400).json({ error: `Unknown agent: ${agentId}` });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Toggle agent enable/disable (via environment variable simulation)
 * Note: This doesn't actually change env vars, but provides status
 * POST /api/dashboard/agents/:agentId/toggle
 */
router.post('/agents/:agentId/toggle', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { enabled } = req.body;

    // Note: In production, you'd want to persist this in a database
    // For now, we'll just return the current status
    const envVarMap: Record<string, string> = {
      adaptiveAI: 'ENABLE_ADAPTIVE_AI',
      storeDesign: 'ENABLE_STORE_DESIGN_AGENT',
      marketing: 'ENABLE_MARKETING_AGENT',
    };

    const envVar = envVarMap[agentId];
    if (!envVar) {
      return res.status(400).json({ error: `Unknown agent: ${agentId}` });
    }

    const currentlyEnabled = process.env[envVar] === 'true';

    res.json({
      agentId,
      currentlyEnabled,
      message: `To ${enabled ? 'enable' : 'disable'} this agent, set ${envVar}=${enabled ? 'true' : 'false'} in your environment variables and restart the server.`,
      note: 'Environment variable changes require server restart. This endpoint shows current status only.',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get agent settings
 * GET /api/dashboard/settings
 */
router.get('/settings', async (req, res) => {
  try {
    const settings: any = {
      adaptiveAI: {
        enabled: process.env.ENABLE_ADAPTIVE_AI === 'true',
        intervalHours: parseInt(process.env.ADAPTIVE_AI_GENERATION_INTERVAL_HOURS || '24', 10),
        minProducts: parseInt(process.env.ADAPTIVE_AI_MIN_PRODUCTS || '3', 10),
        maxProducts: parseInt(process.env.ADAPTIVE_AI_MAX_PRODUCTS || '5', 10),
      },
      storeDesign: {
        enabled: process.env.ENABLE_STORE_DESIGN_AGENT === 'true',
        minConfidence: parseFloat(process.env.DESIGN_AGENT_MIN_CONFIDENCE || '0.7'),
        autoApply: process.env.DESIGN_AGENT_AUTO_APPLY === 'true',
        maxDailyChanges: parseInt(process.env.DESIGN_AGENT_MAX_DAILY_CHANGES || '5', 10),
      },
      marketing: {
        enabled: process.env.ENABLE_MARKETING_AGENT === 'true',
        intervalHours: parseInt(process.env.MARKETING_AGENT_INTERVAL_HOURS || '24', 10),
        autoExecute: process.env.MARKETING_AGENT_AUTO_EXECUTE === 'true',
        minConfidence: parseFloat(process.env.MARKETING_AGENT_MIN_CONFIDENCE || '0.75'),
        maxDailyCampaigns: parseInt(process.env.MARKETING_AGENT_MAX_DAILY_CAMPAIGNS || '3', 10),
      },
    };

    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Update agent settings (read-only for now - shows current values)
 * POST /api/dashboard/settings
 */
router.post('/settings', async (req, res) => {
  try {
    // Note: In production, you'd want to persist settings in a database
    // For now, we'll just return a message about environment variables
    res.json({
      message: 'Settings are controlled via environment variables. Update them in your deployment platform (e.g., Render) and restart the server.',
      currentSettings: await (async () => {
        const { default: router } = await import('./dashboard.js');
        // This is a simplified response - in real implementation, you'd fetch current settings
        return {
          note: 'See GET /api/dashboard/settings for current values',
        };
      })(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;


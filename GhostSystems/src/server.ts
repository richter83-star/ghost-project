import 'dotenv/config'; // Loads variables from .env
import express from 'express';
import { startNexusListener } from './integrations/nexus/listener.js';
import { processDraftProducts } from './integrations/nexus/worker.js';
import { startShopifyPipeline } from './integrations/shopify-pipeline.js';
import shopifyRoutes from './cloud/routes/shopify.js';
import designRoutes from './cloud/routes/design.js';
import marketingRoutes from './cloud/routes/marketing.js';
import marketingAgentRoutes from './cloud/routes/marketing-agent.js';
import dashboardRoutes from './cloud/routes/dashboard.js';
import { startAdaptiveAIListener } from './integrations/adaptive-ai/listener.js';
import { startDynamicPricingListener, getDynamicPricingStatus, triggerPricingOptimization } from './integrations/dynamic-pricing/listener.js';
import { startDesignAgentListener } from './integrations/store-design-agent/listener.js';
import { startMarketingListener } from './integrations/marketing/listener.js';
import { startMarketingAgentListener } from './integrations/marketing-agent/listener.js';

// Initialize Express
const app = express();
const PORT = process.env.PORT || 10000; // Use 10000, as seen in your logs

async function main() {
  console.log('=================================');
  console.log('   GHOST FLEET CONTROLLER     ');
  console.log('=================================');

  // ---------------------------------------------------------
  // 0. Debug: Log ALL incoming requests
  // ---------------------------------------------------------
  app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.path} from ${req.ip}`);
    next();
  });

  // ---------------------------------------------------------
  // 1. Start Web Server
  // This is what Render is checking. 
  // The log [FleetController] live on port 10000 comes from here.
  // ---------------------------------------------------------
  app.get('/', (req, res) => {
    const pricingStatus = getDynamicPricingStatus();
    
    res.status(200).json({
      system: 'Ghost Fleet Controller',
      status: 'Online',
      timestamp: new Date().toISOString(),
      services: {
        nexus: 'active',
        shopifyPipeline: 'active',
        webhooks: 'active',
        adaptiveAI: process.env.ENABLE_ADAPTIVE_AI === 'true' ? 'active' : 'disabled',
        abandonedCartRecovery: process.env.ENABLE_ABANDONED_CART === 'true' ? 'active' : 'disabled',
        dynamicPricing: pricingStatus.enabled ? 'active' : 'disabled',
        aiImages: process.env.ENABLE_AI_IMAGES !== 'false' ? 'active' : 'disabled',
        storeDesignAgent: process.env.ENABLE_STORE_DESIGN_AGENT === 'true' ? 'active' : 'disabled',
        marketing: process.env.ENABLE_MARKETING_AUTOMATION === 'true' ? 'active' : 'disabled',
        marketingAgent: process.env.ENABLE_MARKETING_AGENT === 'true' ? 'active' : 'disabled',
      },
      dynamicPricing: pricingStatus,
    });
  });

  // API endpoint to manually trigger pricing optimization
  app.post('/api/pricing/optimize', express.json(), async (req, res) => {
    const dryRun = req.body?.dryRun === true;
    console.log(`[API] Manual pricing optimization triggered (dryRun: ${dryRun})`);
    
    const result = await triggerPricingOptimization(dryRun);
    res.json(result);
  });

  // API endpoint to get Adaptive AI monitoring stats
  app.get('/api/adaptive-ai/status', async (req, res) => {
    try {
      const { getAdaptiveAIMonitoring } = await import('./integrations/adaptive-ai/listener.js');
      const stats = getAdaptiveAIMonitoring();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ---------------------------------------------------------
  // 2. Webhook Routes
  // Shopify webhooks for order fulfillment
  // ---------------------------------------------------------
  app.use('/webhook/shopify', shopifyRoutes);

  // ---------------------------------------------------------
  // 2b. Design Agent API Routes
  // ---------------------------------------------------------
  app.use('/api/design', designRoutes);

  // ---------------------------------------------------------
  // 2c. Marketing API Routes
  // ---------------------------------------------------------
  app.use('/api/marketing', express.json(), marketingRoutes);

  // ---------------------------------------------------------
  // 2d. Marketing Agent API Routes
  // ---------------------------------------------------------
  app.use('/api/marketing-agent', express.json(), marketingAgentRoutes);

  // ---------------------------------------------------------
  // 2e. Dashboard API Routes
  // ---------------------------------------------------------
  app.use('/api/dashboard', express.json(), dashboardRoutes);

  // ---------------------------------------------------------
  // 2f. Dashboard Frontend (serve static files)
  // ---------------------------------------------------------
  try {
    const path = await import('path');
    const dashboardPath = path.default.join(process.cwd(), 'dashboard', 'dist');
    app.use('/dashboard', express.static(dashboardPath));
    console.log('[INIT] ✅ Dashboard static files configured');
  } catch (error: any) {
    console.log('[INIT] ⚠️ Dashboard not built yet. Run "npm run build" in dashboard/ directory');
  }

  // Catch-all 404 handler for debugging
  app.use('*', (req, res) => {
    console.log(`[404] No route matched: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: 'Route not found', path: req.originalUrl, available: ['/', '/api/design/*', '/api/marketing/*', '/api/marketing-agent/*', '/api/dashboard/*', '/dashboard', '/webhook/shopify/*'] });
  });

  app.listen(PORT, () => {
    // This is the log line you are seeing
    console.log(`[FleetController] live on port ${PORT}`);
  });

  // ---------------------------------------------------------
  // 3. Initialize Firestore Listeners
  // - Nexus Listener: Processes "pending" → "draft"
  // - Shopify Pipeline: Processes "draft" → "published"
  // ---------------------------------------------------------
  try {
    console.log('[INIT] 📡 connecting to Nexus Command...');
    startNexusListener();
  } catch (error) {
    console.error('[ERROR] Failed to start Nexus listener:', error);
  }

  try {
    console.log('[INIT] 🛍️ starting Shopify Pipeline...');
    startShopifyPipeline();
  } catch (error) {
    console.error('[ERROR] Failed to start Shopify pipeline:', error);
  }

  // Draft processor (pending -> draft handled by Nexus, this handles draft -> published)
  try {
    const intervalMs = parseInt(process.env.DRAFT_PROCESSOR_INTERVAL_MS || '300000', 10);
    console.log('[INIT] 🛠️ running Draft Processor...');
    await processDraftProducts();
    setInterval(() => {
      processDraftProducts().catch((err) =>
        console.error('[INIT] Draft processor run failed:', err)
      );
    }, intervalMs);
    console.log(`[INIT] 🛠️ Draft Processor scheduled every ${intervalMs}ms`);
  } catch (error) {
    console.error('[ERROR] Failed to start Draft processor:', error);
  }

  // ---------------------------------------------------------
  // 4. Initialize Adaptive AI (Optional)
  // Generates products based on market insights
  // ---------------------------------------------------------
  if (process.env.ENABLE_ADAPTIVE_AI === 'true') {
    try {
      console.log('[INIT] 🧠 starting Adaptive AI Listener...');
      const { startAdaptiveAIListener } = await import('./integrations/adaptive-ai/listener.js');
      startAdaptiveAIListener();
      console.log('[INIT] ✅ Adaptive AI Listener started successfully');
      console.log(`[INIT]    - Generation interval: ${process.env.ADAPTIVE_AI_GENERATION_INTERVAL_HOURS || '24'} hours`);
      console.log(`[INIT]    - Products per cycle: ${process.env.ADAPTIVE_AI_MIN_PRODUCTS || '3'}-${process.env.ADAPTIVE_AI_MAX_PRODUCTS || '5'}`);
    } catch (error) {
      console.error('[ERROR] Failed to start Adaptive AI listener:', error);
    }
  } else {
    console.log('[INIT] ℹ️ Adaptive AI disabled (set ENABLE_ADAPTIVE_AI=true to enable)');
  }

  // ---------------------------------------------------------
  // 5. Initialize Dynamic Pricing (Optional)
  // Automatically adjusts prices based on sales performance
  // ---------------------------------------------------------
  if (process.env.ENABLE_DYNAMIC_PRICING === 'true') {
    try {
      console.log('[INIT] 💰 starting Dynamic Pricing Listener...');
      startDynamicPricingListener();
    } catch (error) {
      console.error('[ERROR] Failed to start Dynamic Pricing listener:', error);
    }
  } else {
    console.log('[INIT] ℹ️ Dynamic pricing disabled (set ENABLE_DYNAMIC_PRICING=true to enable)');
  }

  // ---------------------------------------------------------
  // 6. Initialize Store Design Agent (Optional)
  // AI-powered store design optimization
  // ---------------------------------------------------------
  if (process.env.ENABLE_STORE_DESIGN_AGENT === 'true') {
    try {
      console.log('[INIT] 🎨 starting Store Design Agent...');
      startDesignAgentListener();
    } catch (error) {
      console.error('[ERROR] Failed to start Store Design Agent:', error);
    }
  } else {
    console.log('[INIT] ℹ️ Store Design Agent disabled (set ENABLE_STORE_DESIGN_AGENT=true to enable)');
  }

  // ---------------------------------------------------------
  // 7. Initialize Marketing Automation (Optional)
  // SEO, email, content, social media automation
  // ---------------------------------------------------------
  if (process.env.ENABLE_MARKETING_AUTOMATION === 'true') {
    try {
      console.log('[INIT] 📢 starting Marketing Automation...');
      startMarketingListener();
    } catch (error) {
      console.error('[ERROR] Failed to start Marketing Automation:', error);
    }
  } else {
    console.log('[INIT] ℹ️ Marketing Automation disabled (set ENABLE_MARKETING_AUTOMATION=true to enable)');
  }

  // ---------------------------------------------------------
  // 8. Initialize Marketing Agent (Optional)
  // Autonomous AI marketing strategy recommendations and execution
  // ---------------------------------------------------------
  if (process.env.ENABLE_MARKETING_AGENT === 'true') {
    try {
      console.log('[INIT] 🎯 starting Marketing Agent...');
      startMarketingAgentListener();
    } catch (error) {
      console.error('[ERROR] Failed to start Marketing Agent:', error);
    }
  } else {
    console.log('[INIT] ℹ️ Marketing Agent disabled (set ENABLE_MARKETING_AGENT=true to enable)');
  }

  // Log feature status
  console.log('[INIT] Feature Status:');
  console.log(`  - AI Images: ${process.env.ENABLE_AI_IMAGES !== 'false' ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`  - Adaptive AI: ${process.env.ENABLE_ADAPTIVE_AI === 'true' ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`  - Abandoned Cart: ${process.env.ENABLE_ABANDONED_CART === 'true' ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`  - Dynamic Pricing: ${process.env.ENABLE_DYNAMIC_PRICING === 'true' ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`  - Store Design Agent: ${process.env.ENABLE_STORE_DESIGN_AGENT === 'true' ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`  - Marketing Automation: ${process.env.ENABLE_MARKETING_AUTOMATION === 'true' ? '✅ Enabled' : '❌ Disabled'}`);
  console.log(`  - Marketing Agent: ${process.env.ENABLE_MARKETING_AGENT === 'true' ? '✅ Enabled' : '❌ Disabled'}`);

  console.log('[SYSTEM] 👻 Ghost is fully operational and waiting for jobs.');
}

// Global Error Handling
process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the Engine
main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

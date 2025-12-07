/**
 * Marketing Agent - Scheduled Listener
 * 
 * Runs the marketing agent on a configurable schedule and monitors campaigns
 */

import { CronJob } from 'cron';
import { runMarketingAgent } from '../../lib/marketing-agent/index.js';
import { getActiveCampaigns } from '../../lib/marketing-agent/campaign-executor.js';

const ENABLE_MARKETING_AGENT = process.env.ENABLE_MARKETING_AGENT === 'true';
const MARKETING_AGENT_INTERVAL_HOURS = parseInt(
  process.env.MARKETING_AGENT_INTERVAL_HOURS || '24',
  10
);

let agentJob: CronJob | null = null;

/**
 * Start the scheduled marketing agent listener
 */
export function startMarketingAgentListener(): void {
  if (!ENABLE_MARKETING_AGENT) {
    console.log('[MarketingAgent] ⚠️ Marketing Agent disabled');
    console.log('[MarketingAgent] Set ENABLE_MARKETING_AGENT=true to enable');
    return;
  }

  // Calculate cron expression based on interval
  let cronExpression = '0 0 * * *'; // Default: daily at midnight

  if (MARKETING_AGENT_INTERVAL_HOURS === 12) {
    cronExpression = '0 0,12 * * *';
  } else if (MARKETING_AGENT_INTERVAL_HOURS === 6) {
    cronExpression = '0 */6 * * *';
  } else if (MARKETING_AGENT_INTERVAL_HOURS === 1) {
    cronExpression = '0 * * * *'; // Every hour (for testing)
  }

  agentJob = new CronJob(
    cronExpression,
    async () => {
      console.log('[MarketingAgent] ⏰ Scheduled run starting...');
      try {
        const result = await runMarketingAgent();
        if (result.success) {
          console.log(`[MarketingAgent] ✅ Scheduled run complete. ${result.recommendations} recommendations.`);
        } else {
          console.error('[MarketingAgent] ❌ Scheduled run failed:', result.error);
        }
      } catch (error: any) {
        console.error('[MarketingAgent] ❌ Scheduled run error:', error.message);
      }
    },
    null,
    true,
    'America/Los_Angeles'
  );

  console.log(`[MarketingAgent] 🎯 Marketing Agent scheduled (every ${MARKETING_AGENT_INTERVAL_HOURS} hours)`);
  console.log(`[MarketingAgent] ⏰ Cron expression: ${cronExpression}`);

  // Run immediately on start
  runMarketingAgent().catch(error => {
    console.error('[MarketingAgent] ❌ Initial run failed:', error);
  });

  // Monitor active campaigns periodically (every hour)
  const campaignMonitorJob = new CronJob(
    '0 * * * *', // Every hour
    async () => {
      try {
        const activeCampaigns = await getActiveCampaigns();
        if (activeCampaigns.length > 0) {
          console.log(`[MarketingAgent] 📊 Monitoring ${activeCampaigns.length} active campaigns`);
          // Could add campaign performance tracking here
        }
      } catch (error: any) {
        console.error('[MarketingAgent] Campaign monitoring error:', error.message);
      }
    },
    null,
    true,
    'America/Los_Angeles'
  );

  console.log('[MarketingAgent] ✅ Marketing Agent Listener is active');
}

/**
 * Stop the marketing agent listener
 */
export function stopMarketingAgentListener(): void {
  if (agentJob) {
    agentJob.stop();
    agentJob = null;
    console.log('[MarketingAgent] ⏹️ Marketing Agent Listener stopped');
  }
}


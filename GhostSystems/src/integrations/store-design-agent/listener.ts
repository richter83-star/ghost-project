/**
 * Store Design Agent - Scheduled Listener
 * 
 * Runs the design agent on a configurable schedule.
 */

import { CronJob } from 'cron';
import { runDesignAgent } from '../../lib/store-design-agent/index.js';

const ENABLE_STORE_DESIGN_AGENT = process.env.ENABLE_STORE_DESIGN_AGENT === 'true';
const DESIGN_AGENT_INTERVAL_HOURS = parseInt(
  process.env.DESIGN_AGENT_INTERVAL_HOURS || '24',
  10
);

let agentJob: CronJob | null = null;

/**
 * Start the scheduled design agent listener
 */
export function startDesignAgentListener(): void {
  if (!ENABLE_STORE_DESIGN_AGENT) {
    console.log('[DesignAgent] ℹ️ Store Design Agent disabled');
    return;
  }

  // Calculate cron expression based on interval
  // For 24 hours: run at midnight
  // For 12 hours: run at midnight and noon
  // For 6 hours: run every 6 hours
  let cronExpression = '0 0 * * *'; // Default: daily at midnight

  if (DESIGN_AGENT_INTERVAL_HOURS === 12) {
    cronExpression = '0 0,12 * * *';
  } else if (DESIGN_AGENT_INTERVAL_HOURS === 6) {
    cronExpression = '0 */6 * * *';
  } else if (DESIGN_AGENT_INTERVAL_HOURS === 1) {
    cronExpression = '0 * * * *'; // Every hour (for testing)
  }

  agentJob = new CronJob(
    cronExpression,
    async () => {
      console.log('[DesignAgent] ⏰ Scheduled run starting...');
      try {
        const result = await runDesignAgent();
        if (result.success) {
          console.log(`[DesignAgent] ✅ Scheduled run complete. ${result.recommendations} recommendations.`);
        } else {
          console.error('[DesignAgent] ❌ Scheduled run failed:', result.error);
        }
      } catch (error: any) {
        console.error('[DesignAgent] ❌ Scheduled run error:', error.message);
      }
    },
    null,
    true,
    'America/Los_Angeles'
  );

  console.log(`[DesignAgent] 🎨 Store Design Agent scheduled (every ${DESIGN_AGENT_INTERVAL_HOURS} hours)`);
  console.log(`[DesignAgent] 📧 Notifications: ${process.env.DESIGN_AGENT_NOTIFY_EMAIL || 'Not configured'}`);
  console.log(`[DesignAgent] 🔄 Auto-apply: ${process.env.DESIGN_AGENT_AUTO_APPLY === 'true' ? 'Enabled' : 'Disabled'}`);
  console.log(`[DesignAgent] 📊 Min confidence: ${process.env.DESIGN_AGENT_MIN_CONFIDENCE || '0.7'}`);

  // Run initial analysis on startup (optional)
  if (process.env.DESIGN_AGENT_RUN_ON_STARTUP === 'true') {
    console.log('[DesignAgent] Running initial analysis...');
    runDesignAgent().catch(console.error);
  }
}

/**
 * Stop the scheduled listener
 */
export function stopDesignAgentListener(): void {
  if (agentJob) {
    agentJob.stop();
    agentJob = null;
    console.log('[DesignAgent] Stopped scheduled listener');
  }
}

/**
 * Trigger a manual run
 */
export async function triggerManualRun(): Promise<{
  success: boolean;
  recommendations: number;
  error?: string;
}> {
  console.log('[DesignAgent] Manual run triggered');
  return runDesignAgent();
}


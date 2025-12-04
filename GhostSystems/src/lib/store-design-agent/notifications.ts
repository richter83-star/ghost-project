/**
 * Store Design Agent - Email Notifications
 * 
 * Sends recommendation summaries and approval requests via Resend.
 */

import { Resend } from 'resend';
import { DesignRecommendation } from './types.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@dracanus-ai.com';
const NOTIFY_EMAIL = process.env.DESIGN_AGENT_NOTIFY_EMAIL || '';
const APP_URL = process.env.APP_URL || 'https://ghostsystems.onrender.com';

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Send recommendation summary email
 */
export async function sendRecommendationEmail(
  recommendations: DesignRecommendation[]
): Promise<boolean> {
  if (!NOTIFY_EMAIL) {
    console.warn('[DesignAgent] DESIGN_AGENT_NOTIFY_EMAIL not set, skipping notification');
    return false;
  }

  if (!process.env.RESEND_API_KEY) {
    console.warn('[DesignAgent] RESEND_API_KEY not set, skipping email');
    return false;
  }

  if (recommendations.length === 0) {
    console.log('[DesignAgent] No recommendations to notify about');
    return false;
  }

  const highPriority = recommendations.filter((r) => r.priority === 'high');
  const mediumPriority = recommendations.filter((r) => r.priority === 'medium');
  const lowPriority = recommendations.filter((r) => r.priority === 'low');

  const totalEstimatedImpact = recommendations.reduce(
    (sum, r) => sum + r.metrics.estimatedImpact,
    0
  );

  const html = buildEmailHtml(recommendations, {
    high: highPriority.length,
    medium: mediumPriority.length,
    low: lowPriority.length,
    totalImpact: totalEstimatedImpact,
  });

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: NOTIFY_EMAIL,
      subject: `🎨 ${recommendations.length} New Store Design Recommendations`,
      html,
    });
    console.log(`[DesignAgent] ✅ Sent recommendation email to ${NOTIFY_EMAIL}`);
    return true;
  } catch (error: any) {
    console.error('[DesignAgent] Failed to send email:', error.message);
    return false;
  }
}

/**
 * Build the recommendation email HTML
 */
function buildEmailHtml(
  recommendations: DesignRecommendation[],
  stats: { high: number; medium: number; low: number; totalImpact: number }
): string {
  const priorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      high: '#dc2626',
      medium: '#f59e0b',
      low: '#3b82f6',
    };
    return `<span style="background: ${colors[priority]}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">${priority.toUpperCase()}</span>`;
  };

  const recommendationCards = recommendations
    .map(
      (rec) => `
    <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px; background: #f9fafb;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        ${priorityBadge(rec.priority)}
        <span style="font-weight: 600; font-size: 14px; color: #374151;">${escapeHtml(rec.type.toUpperCase())}</span>
      </div>
      <h3 style="margin: 0 0 8px 0; color: #111827; font-size: 16px;">${escapeHtml(rec.title)}</h3>
      <p style="margin: 0 0 12px 0; color: #6b7280; font-size: 14px; line-height: 1.5;">${escapeHtml(rec.description)}</p>
      
      <div style="display: flex; gap: 16px; margin-bottom: 12px;">
        <div>
          <span style="color: #9ca3af; font-size: 12px;">Est. Impact</span><br>
          <span style="color: #059669; font-weight: 600;">+${rec.metrics.estimatedImpact}%</span>
        </div>
        <div>
          <span style="color: #9ca3af; font-size: 12px;">Confidence</span><br>
          <span style="color: #111827; font-weight: 600;">${Math.round(rec.metrics.confidence * 100)}%</span>
        </div>
      </div>
      
      <div style="display: flex; gap: 8px;">
        <a href="${APP_URL}/api/design/recommendations/${rec.id}/approve" 
           style="background: #059669; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
          ✓ Approve
        </a>
        <a href="${APP_URL}/api/design/recommendations/${rec.id}/preview" 
           style="background: #3b82f6; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
          👁 Preview
        </a>
        <a href="${APP_URL}/api/design/recommendations/${rec.id}/reject" 
           style="background: #6b7280; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500;">
          ✗ Reject
        </a>
      </div>
    </div>
  `
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1e1e2e 0%, #312e81 100%); padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">🎨 Store Design Agent</h1>
      <p style="color: #a5b4fc; margin: 8px 0 0 0; font-size: 14px;">New design recommendations ready for review</p>
    </div>
    
    <!-- Summary Stats -->
    <div style="display: flex; justify-content: space-around; padding: 20px; background: #f9fafb; border-bottom: 1px solid #e5e7eb;">
      <div style="text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #dc2626;">${stats.high}</div>
        <div style="font-size: 12px; color: #6b7280;">High Priority</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #f59e0b;">${stats.medium}</div>
        <div style="font-size: 12px; color: #6b7280;">Medium Priority</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #3b82f6;">${stats.low}</div>
        <div style="font-size: 12px; color: #6b7280;">Low Priority</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 24px; font-weight: bold; color: #059669;">+${stats.totalImpact}%</div>
        <div style="font-size: 12px; color: #6b7280;">Total Est. Impact</div>
      </div>
    </div>
    
    <!-- Recommendations -->
    <div style="padding: 20px;">
      <h2 style="margin: 0 0 16px 0; color: #111827; font-size: 18px;">Recommendations</h2>
      ${recommendationCards}
    </div>
    
    <!-- Footer -->
    <div style="padding: 20px; text-align: center; background: #f9fafb; border-top: 1px solid #e5e7eb;">
      <p style="margin: 0; color: #6b7280; font-size: 12px;">
        These recommendations are generated by AI based on your store analytics.<br>
        <a href="${APP_URL}/dashboard" style="color: #3b82f6;">View all recommendations in dashboard</a>
      </p>
    </div>
    
  </div>
</body>
</html>
`;
}

/**
 * Send notification when a recommendation is applied
 */
export async function sendAppliedNotification(
  recommendation: DesignRecommendation
): Promise<boolean> {
  if (!NOTIFY_EMAIL || !process.env.RESEND_API_KEY) return false;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: NOTIFY_EMAIL,
      subject: `✅ Design Change Applied: ${recommendation.title}`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #059669;">✅ Design Change Applied</h2>
          <p><strong>${escapeHtml(recommendation.title)}</strong></p>
          <p>${escapeHtml(recommendation.description)}</p>
          <p>The change has been applied to your store. We'll monitor performance and report back in 7 days.</p>
          <p><a href="${APP_URL}/api/design/recommendations/${recommendation.id}/revert" 
                style="background: #dc2626; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none;">
            Revert Change
          </a></p>
        </div>
      `,
    });
    return true;
  } catch (error: any) {
    console.error('[DesignAgent] Failed to send applied notification:', error.message);
    return false;
  }
}

/**
 * Send weekly performance report
 */
export async function sendPerformanceReport(report: {
  appliedChanges: number;
  avgImprovement: number;
  topPerformer: { title: string; improvement: number } | null;
}): Promise<boolean> {
  if (!NOTIFY_EMAIL || !process.env.RESEND_API_KEY) return false;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: NOTIFY_EMAIL,
      subject: `📊 Weekly Store Design Report`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>📊 Weekly Design Performance</h2>
          <ul>
            <li>Changes Applied: ${report.appliedChanges}</li>
            <li>Average Improvement: ${report.avgImprovement > 0 ? '+' : ''}${report.avgImprovement}%</li>
            ${report.topPerformer ? `<li>Best Performer: ${escapeHtml(report.topPerformer.title)} (+${report.topPerformer.improvement}%)</li>` : ''}
          </ul>
          <p><a href="${APP_URL}/dashboard">View full report</a></p>
        </div>
      `,
    });
    return true;
  } catch (error: any) {
    console.error('[DesignAgent] Failed to send performance report:', error.message);
    return false;
  }
}


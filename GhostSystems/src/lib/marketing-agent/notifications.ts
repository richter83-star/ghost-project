/**
 * Marketing Agent - Email Notifications
 * 
 * Sends email notifications for marketing recommendations
 */

import axios from 'axios';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.MARKETING_EMAIL_FROM || process.env.FROM_EMAIL || 'noreply@dracanus.ai';
const NOTIFY_EMAIL = process.env.MARKETING_AGENT_NOTIFY_EMAIL || process.env.MARKETING_EMAIL_FROM || '';
const APP_URL = process.env.APP_URL || 'https://ghostsystems.onrender.com';

/**
 * Send email notification with marketing recommendations
 */
export async function sendRecommendationEmail(
  recommendations: any[]
): Promise<boolean> {
  if (!RESEND_API_KEY || !NOTIFY_EMAIL) {
    console.warn('[MarketingAgent] Email notifications not configured (RESEND_API_KEY or MARKETING_AGENT_NOTIFY_EMAIL missing)');
    return false;
  }

  if (recommendations.length === 0) {
    return true; // Nothing to send
  }

  try {
    // Group recommendations by priority
    const highPriority = recommendations.filter(r => r.priority === 'high');
    const mediumPriority = recommendations.filter(r => r.priority === 'medium');
    const lowPriority = recommendations.filter(r => r.priority === 'low');

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1a1a1a; color: white; padding: 20px; text-align: center; }
    .recommendation { border: 1px solid #ddd; margin: 15px 0; padding: 15px; border-radius: 5px; }
    .high { border-left: 4px solid #e74c3c; }
    .medium { border-left: 4px solid #f39c12; }
    .low { border-left: 4px solid #3498db; }
    .title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
    .description { margin: 10px 0; }
    .metrics { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 3px; }
    .actions { margin-top: 15px; }
    .btn { display: inline-block; padding: 10px 20px; margin: 5px; text-decoration: none; border-radius: 3px; }
    .btn-approve { background: #27ae60; color: white; }
    .btn-reject { background: #e74c3c; color: white; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 Marketing Strategy Recommendations</h1>
      <p>${recommendations.length} new recommendations ready for review</p>
    </div>

    ${highPriority.length > 0 ? `
    <h2>🔥 High Priority (${highPriority.length})</h2>
    ${highPriority.map(rec => generateRecommendationHTML(rec)).join('')}
    ` : ''}

    ${mediumPriority.length > 0 ? `
    <h2>⚡ Medium Priority (${mediumPriority.length})</h2>
    ${mediumPriority.map(rec => generateRecommendationHTML(rec)).join('')}
    ` : ''}

    ${lowPriority.length > 0 ? `
    <h2>💡 Low Priority (${lowPriority.length})</h2>
    ${lowPriority.map(rec => generateRecommendationHTML(rec)).join('')}
    ` : ''}

    <div class="footer">
      <p>This is an automated email from the Marketing Agent.</p>
      <p>View all recommendations: <a href="${APP_URL}/api/marketing-agent/recommendations">${APP_URL}/api/marketing-agent/recommendations</a></p>
    </div>
  </div>
</body>
</html>`;

    await axios.post(
      'https://api.resend.com/emails',
      {
        from: RESEND_FROM_EMAIL,
        to: NOTIFY_EMAIL,
        subject: `🎯 ${recommendations.length} Marketing Strategy Recommendations`,
        html,
      },
      {
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`[MarketingAgent] ✅ Sent recommendation email to ${NOTIFY_EMAIL}`);
    return true;
  } catch (error: any) {
    console.error('[MarketingAgent] Failed to send recommendation email:', error.message);
    return false;
  }
}

/**
 * Generate HTML for a single recommendation
 */
function generateRecommendationHTML(rec: any): string {
  const priorityClass = rec.priority || 'medium';
  const approveUrl = `${APP_URL}/api/marketing-agent/recommendations/${rec.id}/approve`;
  const rejectUrl = `${APP_URL}/api/marketing-agent/recommendations/${rec.id}/reject`;

  return `
    <div class="recommendation ${priorityClass}">
      <div class="title">${rec.title}</div>
      <div class="description">${rec.description}</div>
      <div class="metrics">
        <strong>Expected Impact:</strong> ${rec.metrics?.expectedImpact || 0}% improvement<br>
        <strong>Confidence:</strong> ${((rec.metrics?.confidence || 0) * 100).toFixed(0)}%<br>
        ${rec.metrics?.expectedTraffic ? `<strong>Expected Traffic:</strong> ${rec.metrics.expectedTraffic} visitors<br>` : ''}
        ${rec.metrics?.expectedRevenue ? `<strong>Expected Revenue:</strong> $${rec.metrics.expectedRevenue.toFixed(2)}<br>` : ''}
      </div>
      <div class="actions">
        <a href="${approveUrl}" class="btn btn-approve">✅ Approve</a>
        <a href="${rejectUrl}" class="btn btn-reject">❌ Reject</a>
      </div>
    </div>
  `;
}


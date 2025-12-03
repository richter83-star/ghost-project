import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { fetchProductMetafield } from '../../lib/shopify.js';

const router = express.Router();

// Configuration
const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@example.com';

// Rate limiting for webhook endpoint
// Allow 100 requests per 15 minutes per IP (Shopify typically sends 1-2 per order)
const webhookRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many webhook requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * Verify Shopify webhook signature
 */
function verifyShopifyWebhook(
  req: express.Request,
  rawBody: Buffer
): boolean {
  const hmac = req.get('X-Shopify-Hmac-Sha256');
  if (!hmac) {
    console.warn('[ShopifyWebhook] Webhook received without HMAC signature.');
    return false;
  }

  if (!SHOPIFY_WEBHOOK_SECRET) {
    console.warn('[ShopifyWebhook] SHOPIFY_WEBHOOK_SECRET not configured. Skipping verification.');
    return true; // Allow if secret not configured (for development)
  }

  const genHash = crypto
    .createHmac('sha256', SHOPIFY_WEBHOOK_SECRET)
    .update(rawBody, 'utf8')
    .digest('base64');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(genHash),
      Buffer.from(hmac)
    );
  } catch (error) {
    return false;
  }
}

/**
 * Send email via Resend API
 */
async function sendEmail(
  to: string,
  subject: string,
  htmlContent: string
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[ShopifyWebhook] RESEND_API_KEY not configured. Cannot send email.');
    return false;
  }

  const url = 'https://api.resend.com/emails';
  const payload = {
    from: FROM_EMAIL,
    to,
    subject,
    html: htmlContent,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(`Email API error: ${JSON.stringify(errorBody)}`);
    }

    console.log(`[ShopifyWebhook] ✅ Successfully sent email to ${to}`);
    return true;
  } catch (error: any) {
    console.error(`[ShopifyWebhook] ❌ Failed to send email:`, error.message);
    return false;
  }
}

/**
 * Shopify order paid webhook
 * Handles digital goods delivery via email
 */
router.post(
  '/order-paid',
  webhookRateLimiter, // Rate limiting middleware
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    // Verify webhook signature
    const rawBody = req.body as Buffer;
    const isVerified = verifyShopifyWebhook(req, rawBody);

    if (!isVerified) {
      console.warn('[ShopifyWebhook] Webhook verification failed. Discarding request.');
      return res.status(401).send('Unauthorized');
    }

    // Acknowledge webhook immediately (Shopify expects quick response)
    res.status(200).send('Webhook received.');

    // Process order asynchronously
    try {
      const order = JSON.parse(rawBody.toString('utf8'));
      const customerEmail = order.email;
      const lineItems = order.line_items || [];

      if (!customerEmail || lineItems.length === 0) {
        console.log(
          '[ShopifyWebhook] Order is missing email or line items. Skipping.'
        );
        return;
      }

      console.log(
        `[ShopifyWebhook] Processing order for ${customerEmail} (${lineItems.length} items)...`
      );

      let emailHtmlContent = `
        <h1>Your Digital Goods</h1>
        <p>Thank you for your purchase! Here is the content you ordered:</p>
        <hr>
      `;

      // Fetch metafields for each product
      for (const item of lineItems) {
        const productId = item.product_id;
        if (!productId) continue;

        console.log(
          `[ShopifyWebhook] Fetching digital content for product ${productId}...`
        );

        const digitalContent = await fetchProductMetafield(
          String(productId),
          'digital_goods',
          'content'
        );

        if (digitalContent) {
          emailHtmlContent += `
            <h2>${item.title}</h2>
            <pre style="background-color:#f4f4f4; padding: 1em; border-radius: 5px; white-space: pre-wrap;">${digitalContent}</pre>
          `;
        } else {
          console.warn(
            `[ShopifyWebhook] No digital content found for product ${productId}`
          );
        }
      }

      // Send email
      await sendEmail(
        customerEmail,
        'Your Digital Goods from Dracanus AI',
        emailHtmlContent
      );
    } catch (error: any) {
      console.error(
        '[ShopifyWebhook] ❌ Failed to process order webhook:',
        error.message
      );
      // Don't throw - we already sent 200, just log the error
    }
  }
);

export default router;


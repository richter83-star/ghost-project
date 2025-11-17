import express from 'express';
import crypto from 'crypto';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

// --- Configuration ---
const config = {
  port: process.env.PORT || 10000,
  shopify: {
    adminToken: process.env.SHOPIFY_ADMIN_API_TOKEN,
    storeUrl: process.env.SHOPIFY_STORE_URL,
    apiVersion: process.env.SHOPIFY_API_VERSION,
    webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET,
  },
  email: {
    resendApiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.FROM_EMAIL,
  }
};

// --- Security: Verify Webhook Signature ---
function verifyShopifyWebhook(req) {
  const hmac = req.get('X-Shopify-Hmac-Sha256');
  if (!hmac) {
    console.warn('Webhook received without HMAC signature.');
    return false;
  }

  const genHash = crypto
    .createHmac('sha256', config.shopify.webhookSecret)
    .update(req.body, 'utf8')
    .digest('base64');

  return crypto.timingSafeEqual(Buffer.from(genHash), Buffer.from(hmac));
}

// --- Shopify API Helper ---
async function fetchProductMetafield(productId) {
  const url = `https://${config.shopify.storeUrl}/admin/api/${config.shopify.apiVersion}/products/${productId}/metafields.json`;
  const options = {
    method: 'GET',
    headers: { 'X-Shopify-Access-Token': config.shopify.adminToken }
  };

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.statusText}`);
    }
    const data = await response.json();
    
    // Find our specific metafield
    const digitalGood = data.metafields.find(
      (mf) => mf.namespace === 'digital_goods' && mf.key === 'content'
    );

    return digitalGood ? digitalGood.value : null;
  } catch (error) {
    console.error(`Failed to fetch metafield for product ${productId}:`, error.message);
    return null;
  }
}

// --- Email Helper (Resend.com) ---
async function sendEmail(to, subject, htmlContent) {
  const url = 'https://api.resend.com/emails';
  const payload = {
    from: config.email.fromEmail,
    to: to,
    subject: subject,
    html: htmlContent,
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.email.resendApiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(`Email API error: ${JSON.stringify(errorBody)}`);
    }
    
    console.log(`Successfully sent email to ${to}`);
  } catch (error) {
    console.error(`Failed to send email:`, error.message);
  }
}

// --- Initialize Express Server ---
const app = express();

// Use express.raw to get the raw body, which is required for HMAC verification
app.use(express.raw({ type: 'application/json' }));

// --- The Webhook Endpoint ---
app.post('/webhook/shopify/order-paid', async (req, res) => {
  // 1. Verify the webhook signature
  const isVerified = verifyShopifyWebhook(req);
  if (!isVerified) {
    console.warn('Webhook verification failed. Discarding request.');
    return res.status(401).send('Unauthorized');
  }

  // 2. Acknowledge the webhook immediately
  // This tells Shopify "we got it," so it doesn't retry.
  res.status(200).send('Webhook received.');

  // 3. Process the order asynchronously
  try {
    const order = JSON.parse(req.body.toString());
    const customerEmail = order.email;
    const lineItems = order.line_items;

    if (!customerEmail || !lineItems || lineItems.length === 0) {
      console.log('Order is missing email or line items. Skipping.');
      return;
    }

    console.log(`Processing order for ${customerEmail}...`);
    let emailHtmlContent = `<h1>Your Digital Goods</h1><p>Thank you for your purchase! Here is the content you ordered:</p><hr>`;
    
    // 4. Fetch metafields for each product
    for (const item of lineItems) {
      const productId = item.product_id;
      const digitalContent = await fetchProductMetafield(productId);
      
      if (digitalContent) {
        emailHtmlContent += `
          <h2>${item.title}</h2>
          <pre style="background-color:#f4f4f4; padding: 1em; border-radius: 5px; white-space: pre-wrap;">${digitalContent}</pre>
        `;
      }
    }

    // 5. Send the email
    await sendEmail(
      customerEmail,
      'Your Digital Goods from Ghost-Project',
      emailHtmlContent
    );
    
  } catch (error) {
    console.error('Failed to process order webhook:', error.message);
    // We've already sent status 200, so we just log the error.
  }
});

// --- Start the Server ---
app.listen(config.port, () => {
  console.log(`Digital Delivery Service listening on port ${config.port}`);
});
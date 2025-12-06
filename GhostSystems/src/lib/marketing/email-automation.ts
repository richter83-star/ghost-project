/**
 * Email Marketing Automation
 * 
 * Automated email campaigns:
 * - Welcome emails for new customers
 * - Abandoned cart recovery
 * - Product recommendations
 * - Newsletter automation
 */

import { getFirestore } from 'firebase-admin/firestore';
import axios from 'axios';

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || process.env.MARKETING_EMAIL_FROM || 'noreply@dracanus.ai';
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL || '';
const BASE_STORE_URL = `https://${SHOPIFY_STORE_URL.replace(/^https?:\/\//, '')}`;

const db = getFirestore();

export interface EmailCampaign {
  type: 'welcome' | 'abandoned_cart' | 'product_recommendation' | 'newsletter';
  recipient: string;
  subject: string;
  html: string;
  metadata?: Record<string, any>;
}

/**
 * Send email via Resend API
 */
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not configured, skipping email');
    return false;
  }

  try {
    const response = await axios.post(
      'https://api.resend.com/emails',
      {
        from: RESEND_FROM_EMAIL,
        to,
        subject,
        html,
      },
      {
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.status === 200;
  } catch (error: any) {
    console.error('[Email] Failed to send email:', error.message);
    return false;
  }
}

/**
 * Generate welcome email for new customer
 */
export function generateWelcomeEmail(customerName: string, customerEmail: string): EmailCampaign {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Inter', sans-serif; background: #0d0d0d; color: #e8e8e8; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #1a1a1a; border: 1px solid #2a2a2e; border-radius: 12px; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; }
    .button { display: inline-block; background: linear-gradient(145deg, #2d2d30 0%, #3d3d42 50%, #2d2d30 100%); color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    .footer { margin-top: 40px; text-align: center; color: #8a8a8f; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to DRACANUS AI</h1>
    </div>
    <p>Hi ${customerName || 'there'},</p>
    <p>Thank you for joining DRACANUS AI! We're excited to have you on board.</p>
    <p>Explore our premium AI products designed for modern creators, agencies, and solopreneurs.</p>
    <div style="text-align: center;">
      <a href="${BASE_STORE_URL}" class="button">Browse Products</a>
    </div>
    <p>If you have any questions, just reply to this email.</p>
    <div class="footer">
      <p>DRACANUS AI - Premium Digital Products</p>
      <p><a href="${BASE_STORE_URL}" style="color: #b8b8bc;">Visit Store</a></p>
    </div>
  </div>
</body>
</html>
  `;

  return {
    type: 'welcome',
    recipient: customerEmail,
    subject: 'Welcome to DRACANUS AI! 🐉',
    html,
  };
}

/**
 * Generate abandoned cart recovery email
 */
export function generateAbandonedCartEmail(
  customerEmail: string,
  cartItems: Array<{ title: string; price: number; image?: string }>
): EmailCampaign {
  const itemsHtml = cartItems.map(item => `
    <div style="display: flex; margin: 20px 0; padding: 20px; background: #141416; border-radius: 8px;">
      ${item.image ? `<img src="${item.image}" alt="${item.title}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 4px; margin-right: 20px;">` : ''}
      <div>
        <h3 style="margin: 0 0 10px 0;">${item.title}</h3>
        <p style="color: #b8b8bc; margin: 0;">$${item.price}</p>
      </div>
    </div>
  `).join('');

  const total = cartItems.reduce((sum, item) => sum + item.price, 0);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Inter', sans-serif; background: #0d0d0d; color: #e8e8e8; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #1a1a1a; border: 1px solid #2a2a2e; border-radius: 12px; padding: 40px; }
    .button { display: inline-block; background: linear-gradient(145deg, #2d2d30 0%, #3d3d42 50%, #2d2d30 100%); color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>You left items in your cart!</h1>
    <p>Don't miss out on these premium products:</p>
    ${itemsHtml}
    <div style="text-align: center; margin: 30px 0;">
      <p style="font-size: 24px; font-weight: 600; color: #b8b8bc;">Total: $${total.toFixed(2)}</p>
      <a href="${BASE_STORE_URL}/cart" class="button">Complete Your Purchase</a>
    </div>
    <p style="color: #8a8a8f; font-size: 14px;">This offer expires in 48 hours.</p>
  </div>
</body>
</html>
  `;

  return {
    type: 'abandoned_cart',
    recipient: customerEmail,
    subject: 'Complete your purchase - ${cartItems.length} item(s) waiting',
    html,
    metadata: { cartItems, total },
  };
}

/**
 * Generate product recommendation email
 */
export function generateProductRecommendationEmail(
  customerEmail: string,
  recommendedProducts: Array<{ title: string; price: number; image?: string; handle: string }>
): EmailCampaign {
  const productsHtml = recommendedProducts.map(product => `
    <div style="text-align: center; margin: 20px 0; padding: 20px; background: #141416; border-radius: 8px;">
      ${product.image ? `<img src="${product.image}" alt="${product.title}" style="width: 100%; max-width: 300px; height: 200px; object-fit: cover; border-radius: 4px; margin-bottom: 15px;">` : ''}
      <h3 style="margin: 0 0 10px 0;">${product.title}</h3>
      <p style="color: #b8b8bc; margin: 0 0 15px 0;">$${product.price}</p>
      <a href="${BASE_STORE_URL}/products/${product.handle}" class="button" style="font-size: 14px; padding: 10px 20px;">View Product</a>
    </div>
  `).join('');

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Inter', sans-serif; background: #0d0d0d; color: #e8e8e8; padding: 20px; }
    .container { max-width: 600px; margin: 0 auto; background: #1a1a1a; border: 1px solid #2a2a2e; border-radius: 12px; padding: 40px; }
    .button { display: inline-block; background: linear-gradient(145deg, #2d2d30 0%, #3d3d42 50%, #2d2d30 100%); color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Products You Might Like</h1>
    <p>Based on your interests, here are some products we think you'll love:</p>
    ${productsHtml}
    <div style="text-align: center; margin-top: 30px;">
      <a href="${BASE_STORE_URL}" class="button">Browse All Products</a>
    </div>
  </div>
</body>
</html>
  `;

  return {
    type: 'product_recommendation',
    recipient: customerEmail,
    subject: 'Recommended for you - Premium AI Products',
    html,
    metadata: { recommendedProducts },
  };
}

/**
 * Send welcome email to new customer
 */
export async function sendWelcomeEmail(customerEmail: string, customerName?: string): Promise<boolean> {
  const campaign = generateWelcomeEmail(customerName || 'Customer', customerEmail);
  return await sendEmail(campaign.recipient, campaign.subject, campaign.html);
}

/**
 * Send abandoned cart recovery email
 */
export async function sendAbandonedCartEmail(
  customerEmail: string,
  cartItems: Array<{ title: string; price: number; image?: string }>
): Promise<boolean> {
  const campaign = generateAbandonedCartEmail(customerEmail, cartItems);
  return await sendEmail(campaign.recipient, campaign.subject, campaign.html);
}

/**
 * Send product recommendation email
 */
export async function sendProductRecommendationEmail(
  customerEmail: string,
  recommendedProducts: Array<{ title: string; price: number; image?: string; handle: string }>
): Promise<boolean> {
  const campaign = generateProductRecommendationEmail(customerEmail, recommendedProducts);
  return await sendEmail(campaign.recipient, campaign.subject, campaign.html);
}

/**
 * Track email campaign in Firestore
 */
export async function trackEmailCampaign(campaign: EmailCampaign): Promise<void> {
  try {
    await db.collection('email_campaigns').add({
      ...campaign,
      sentAt: new Date(),
      status: 'sent',
    });
  } catch (error: any) {
    console.error('[Email] Failed to track campaign:', error.message);
  }
}


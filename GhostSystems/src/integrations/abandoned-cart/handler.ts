/**
 * Abandoned Cart Handler
 * 
 * Tracks abandoned checkouts and sends recovery emails
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

let db: FirebaseFirestore.Firestore | null = null;

// Configuration
const ABANDONED_CART_COLLECTION = 'abandoned_carts';
const RECOVERY_DELAY_HOURS = 1; // Send first email after 1 hour
const SECOND_EMAIL_HOURS = 24; // Send second email after 24 hours
const EXPIRY_DAYS = 7; // Mark as expired after 7 days
const DISCOUNT_CODE = process.env.ABANDONED_CART_DISCOUNT_CODE || 'COMEBACK10';
const STORE_URL = process.env.SHOPIFY_STORE_URL || 'dracanus-ai.myshopify.com';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@dracanus-ai.com';

interface AbandonedCart {
  checkoutId: string;
  checkoutToken: string;
  email: string;
  totalPrice: number;
  currency: string;
  lineItems: Array<{
    title: string;
    quantity: number;
    price: number;
    imageUrl?: string;
  }>;
  abandonedUrl: string;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  status: 'abandoned' | 'recovered' | 'expired' | 'email_sent_1' | 'email_sent_2';
  emailsSent: number;
  lastEmailAt?: FirebaseFirestore.Timestamp;
  recoveredAt?: FirebaseFirestore.Timestamp;
}

/**
 * Initialize Firebase Admin
 */
function initFirebase() {
  if (db) return;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    console.error('[AbandonedCart] ❌ FIREBASE_SERVICE_ACCOUNT_JSON missing.');
    return;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    if (!getApps().length) {
      initializeApp({ credential: cert(serviceAccount as any) });
    }
    db = getFirestore();
    console.log('[AbandonedCart] ✅ Firebase initialized.');
  } catch (err) {
    console.error('[AbandonedCart] ❌ Failed to initialize Firebase:', err);
  }
}

/**
 * Store or update checkout data
 */
export async function storeCheckout(checkoutData: any): Promise<void> {
  initFirebase();
  if (!db) return;

  const checkoutId = String(checkoutData.id || checkoutData.token);
  const email = checkoutData.email;

  // Skip if no email (guest checkout not started)
  if (!email) {
    console.log(`[AbandonedCart] Checkout ${checkoutId} has no email, skipping.`);
    return;
  }

  const lineItems = (checkoutData.line_items || []).map((item: any) => ({
    title: item.title || 'Product',
    quantity: item.quantity || 1,
    price: parseFloat(item.price) || 0,
    imageUrl: item.image?.src,
  }));

  const cartData: Partial<AbandonedCart> = {
    checkoutId,
    checkoutToken: checkoutData.token || checkoutId,
    email,
    totalPrice: parseFloat(checkoutData.total_price) || 0,
    currency: checkoutData.currency || 'USD',
    lineItems,
    abandonedUrl: checkoutData.abandoned_checkout_url || 
      `https://${STORE_URL}/checkouts/${checkoutData.token}`,
    updatedAt: FieldValue.serverTimestamp() as any,
    status: 'abandoned',
    emailsSent: 0,
  };

  try {
    const docRef = db.collection(ABANDONED_CART_COLLECTION).doc(checkoutId);
    const existingDoc = await docRef.get();

    if (existingDoc.exists) {
      // Update existing checkout
      await docRef.update({
        ...cartData,
        // Don't overwrite these fields
        createdAt: existingDoc.data()?.createdAt,
        emailsSent: existingDoc.data()?.emailsSent || 0,
        status: existingDoc.data()?.status || 'abandoned',
      });
      console.log(`[AbandonedCart] Updated checkout ${checkoutId} for ${email}`);
    } else {
      // New checkout
      await docRef.set({
        ...cartData,
        createdAt: FieldValue.serverTimestamp(),
      });
      console.log(`[AbandonedCart] Stored new checkout ${checkoutId} for ${email}`);
    }
  } catch (error: any) {
    console.error(`[AbandonedCart] ❌ Failed to store checkout:`, error.message);
  }
}

/**
 * Mark checkout as recovered (order completed)
 */
export async function markCheckoutRecovered(orderId: string, email: string): Promise<void> {
  initFirebase();
  if (!db) return;

  try {
    // Find checkout by email (most recent)
    const snapshot = await db
      .collection(ABANDONED_CART_COLLECTION)
      .where('email', '==', email)
      .where('status', 'in', ['abandoned', 'email_sent_1', 'email_sent_2'])
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      await doc.ref.update({
        status: 'recovered',
        recoveredAt: FieldValue.serverTimestamp(),
        recoveredOrderId: orderId,
      });
      console.log(`[AbandonedCart] ✅ Marked checkout ${doc.id} as recovered (order: ${orderId})`);
    }
  } catch (error: any) {
    console.error(`[AbandonedCart] ❌ Failed to mark recovered:`, error.message);
  }
}

/**
 * Get abandoned carts ready for recovery emails
 */
export async function getAbandonedCartsForRecovery(): Promise<AbandonedCart[]> {
  initFirebase();
  if (!db) return [];

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - RECOVERY_DELAY_HOURS * 60 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - SECOND_EMAIL_HOURS * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  try {
    const cartsToEmail: AbandonedCart[] = [];

    // Get carts that need first email (abandoned for 1+ hours, no emails sent)
    const firstEmailQuery = await db
      .collection(ABANDONED_CART_COLLECTION)
      .where('status', '==', 'abandoned')
      .where('emailsSent', '==', 0)
      .get();

    for (const doc of firstEmailQuery.docs) {
      const data = doc.data() as AbandonedCart;
      const createdAt = data.createdAt?.toDate?.() || new Date();
      if (createdAt < oneHourAgo && createdAt > sevenDaysAgo) {
        cartsToEmail.push({ ...data, checkoutId: doc.id });
      }
    }

    // Get carts that need second email (24+ hours, 1 email sent)
    const secondEmailQuery = await db
      .collection(ABANDONED_CART_COLLECTION)
      .where('status', '==', 'email_sent_1')
      .where('emailsSent', '==', 1)
      .get();

    for (const doc of secondEmailQuery.docs) {
      const data = doc.data() as AbandonedCart;
      const lastEmailAt = data.lastEmailAt?.toDate?.() || new Date();
      if (lastEmailAt < twentyFourHoursAgo) {
        cartsToEmail.push({ ...data, checkoutId: doc.id });
      }
    }

    // Mark expired carts
    const expiredQuery = await db
      .collection(ABANDONED_CART_COLLECTION)
      .where('status', 'in', ['abandoned', 'email_sent_1', 'email_sent_2'])
      .get();

    for (const doc of expiredQuery.docs) {
      const data = doc.data() as AbandonedCart;
      const createdAt = data.createdAt?.toDate?.() || new Date();
      if (createdAt < sevenDaysAgo) {
        await doc.ref.update({ status: 'expired' });
        console.log(`[AbandonedCart] Marked ${doc.id} as expired`);
      }
    }

    console.log(`[AbandonedCart] Found ${cartsToEmail.length} carts ready for recovery emails`);
    return cartsToEmail;
  } catch (error: any) {
    console.error(`[AbandonedCart] ❌ Failed to get carts:`, error.message);
    return [];
  }
}

/**
 * Generate recovery email HTML
 */
function generateRecoveryEmailHtml(cart: AbandonedCart, isSecondEmail: boolean): string {
  const itemsHtml = cart.lineItems
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.title}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">` : ''}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">
          <strong>${escapeHtml(item.title)}</strong><br>
          Qty: ${item.quantity}
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">
          $${item.price.toFixed(2)}
        </td>
      </tr>
    `
    )
    .join('');

  const discountSection = isSecondEmail
    ? `
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
        <h3 style="margin: 0 0 10px 0;">Special Offer Just For You!</h3>
        <p style="margin: 0;">Use code <strong style="font-size: 1.2em; background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 4px;">${DISCOUNT_CODE}</strong> for 10% off</p>
      </div>
    `
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #1a1a1a; margin-bottom: 10px;">
          ${isSecondEmail ? "Still thinking it over?" : "You left something behind!"}
        </h1>
        <p style="color: #666; font-size: 16px;">
          ${isSecondEmail 
            ? "We noticed you haven't completed your purchase. Here's a little incentive to help you decide." 
            : "Your cart is waiting for you. Complete your purchase before it's gone!"}
        </p>
      </div>

      ${discountSection}

      <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #1a1a1a;">Your Cart</h3>
        <table style="width: 100%; border-collapse: collapse;">
          ${itemsHtml}
          <tr>
            <td colspan="2" style="padding: 15px 10px; font-weight: bold; text-align: right;">Total:</td>
            <td style="padding: 15px 10px; font-weight: bold; text-align: right; font-size: 1.2em;">
              $${cart.totalPrice.toFixed(2)} ${cart.currency}
            </td>
          </tr>
        </table>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${cart.abandonedUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; font-size: 16px;">
          Complete Your Purchase
        </a>
      </div>

      <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
        <p>Need help? Just reply to this email and we'll be happy to assist.</p>
        <p>© ${new Date().getFullYear()} Dracanus AI. All rights reserved.</p>
      </div>
    </body>
    </html>
  `;
}

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
 * Send recovery email
 */
async function sendRecoveryEmail(cart: AbandonedCart, isSecondEmail: boolean): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[AbandonedCart] RESEND_API_KEY not configured.');
    return false;
  }

  const subject = isSecondEmail
    ? `Don't miss out! Complete your purchase + get 10% off`
    : `You left items in your cart at Dracanus AI`;

  const html = generateRecoveryEmailHtml(cart, isSecondEmail);

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: cart.email,
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json();
      throw new Error(`Email API error: ${JSON.stringify(errorBody)}`);
    }

    console.log(`[AbandonedCart] ✅ Sent recovery email ${isSecondEmail ? '2' : '1'} to ${cart.email}`);
    return true;
  } catch (error: any) {
    console.error(`[AbandonedCart] ❌ Failed to send email:`, error.message);
    return false;
  }
}

/**
 * Process abandoned carts and send recovery emails
 */
export async function processAbandonedCarts(): Promise<{ sent: number; failed: number }> {
  initFirebase();
  if (!db) return { sent: 0, failed: 0 };

  const enableRecovery = process.env.ENABLE_ABANDONED_CART === 'true';
  if (!enableRecovery) {
    console.log('[AbandonedCart] Recovery emails disabled (ENABLE_ABANDONED_CART !== true)');
    return { sent: 0, failed: 0 };
  }

  const carts = await getAbandonedCartsForRecovery();
  let sent = 0;
  let failed = 0;

  for (const cart of carts) {
    const isSecondEmail = cart.emailsSent === 1;
    const success = await sendRecoveryEmail(cart, isSecondEmail);

    if (success) {
      sent++;
      const newStatus = isSecondEmail ? 'email_sent_2' : 'email_sent_1';
      await db.collection(ABANDONED_CART_COLLECTION).doc(cart.checkoutId).update({
        status: newStatus,
        emailsSent: cart.emailsSent + 1,
        lastEmailAt: FieldValue.serverTimestamp(),
      });
    } else {
      failed++;
    }

    // Rate limit: wait between emails
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log(`[AbandonedCart] Recovery complete: ${sent} sent, ${failed} failed`);
  return { sent, failed };
}


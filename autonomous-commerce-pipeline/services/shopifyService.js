// autonomous-commerce-pipeline/integrations/shopify/createProduct.js
import { config } from '../config.js';
import { fetchWithRetry } from '../utils/apiHelper.js';

const { storeUrl, adminToken, apiVersion } = config.shopify;
const shopifyApiUrl = `https://${storeUrl}/admin/api/${apiVersion}/products.json`;

function escapeHtml(s = '') {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function asMoney(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0.00';
  return n.toFixed(2);
}

function pickProductType(jobData) {
  return (
    jobData.product_type ||
    jobData.productType ||
    'digital'
  );
}

function pickPrice(jobData) {
  // supports both old and new oracle fields
  return (
    jobData.price_usd ??
    jobData.price ??
    jobData.metrics?.price_usd ??
    0
  );
}

function pickImageUrl(jobData) {
  return (
    jobData.imageUrl ||
    jobData.image_url ||
    jobData.image?.url ||
    jobData.image?.src ||
    ''
  );
}

function buildBodyHtml(jobData) {
  const title = escapeHtml(jobData.title || '');
  const desc = escapeHtml(jobData.description || '');

  const hooks = Array.isArray(jobData.hooks) ? jobData.hooks : [];
  const includes =
    jobData.payload?.bundle_includes?.prompt_pack?.deliverables ||
    jobData.payload?.includes ||
    [];

  const hookHtml = hooks.length
    ? `<h3>What you get</h3><ul>${hooks.map(h => `<li>${escapeHtml(h)}</li>`).join('')}</ul>`
    : '';

  const includesHtml = Array.isArray(includes) && includes.length
    ? `<h3>Deliverables</h3><ul>${includes.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`
    : '';

  // Keep clean. Shopify renders this fine.
  return `
    <h1>${title}</h1>
    <p>${desc}</p>
    ${hookHtml}
    ${includesHtml}
  `.trim();
}

/**
 * Creates a new product in Shopify.
 * @param {object} jobData - Product job data (from Firestore).
 * @returns {Promise<string>} - The shopifyProductId.
 */
export async function createProduct(jobData) {
  const title = jobData.title || 'Untitled Product';
  const productType = pickProductType(jobData);
  const price = asMoney(pickPrice(jobData));
  const imageUrl = pickImageUrl(jobData);

  const tags = Array.isArray(jobData.tags) ? jobData.tags : [];
  const isBundle = productType === 'bundle' || tags.includes('bundle');

  // Digital goods: do NOT enable Shopify inventory tracking.
  const variant = {
    price,
    requires_shipping: false,
  };

  const product = {
    title,
    body_html: buildBodyHtml(jobData),
    product_type: productType,
    status: 'active', // switch to "draft" if you want review-before-publish
    tags: [...new Set([
      ...tags,
      'ghost',
      isBundle ? 'bundle' : null,
      'digital',
    ].filter(Boolean))].join(', '),
    variants: [variant],
  };

  // Add image only if present (Shopify will reject empty src sometimes)
  if (imageUrl) {
    product.images = [{ src: imageUrl }];
  }

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': adminToken,
    },
    body: JSON.stringify({ product }),
  };

  const result = await fetchWithRetry(shopifyApiUrl, options);

  if (!result?.product?.id) {
    throw new Error('Shopify API returned an invalid product response.');
  }

  return String(result.product.id);
}

import axios from 'axios';
import { getBestCategory } from './category-mapper.js';

/**
 * Unified Shopify Client
 * Standardized configuration and API calls for dracanus-ai.myshopify.com
 */

/**
 * Escape HTML to prevent XSS attacks
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

// Standardized configuration
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL || '';
const SHOPIFY_ADMIN_API_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN || '';
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2025-01';

// Ensure store URL doesn't have protocol prefix
const normalizeStoreUrl = (url: string): string => {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
};

const BASE_URL = `https://${normalizeStoreUrl(SHOPIFY_STORE_URL)}/admin/api/${SHOPIFY_API_VERSION}`;

/**
 * Get standard Shopify API headers
 */
function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': SHOPIFY_ADMIN_API_TOKEN,
  };
}

/**
 * Create a new product in Shopify
 * @param productData - Product data (title, description, productType, price, imageUrl)
 * @returns Promise<string> - The Shopify product ID
 */
export async function createProduct(productData: {
  title: string;
  description: string;
  productType: string;
  price: number;
  imageUrl?: string;
}): Promise<string> {
  const { title, description, productType, price, imageUrl } = productData;

  // Escape HTML in description to prevent XSS injection attacks
  const escapedDescription = escapeHtml(description);
  
  // Map product type to proper Shopify category
  const shopifyCategory = getBestCategory(title, productType);

  const shopifyProductPayload = {
    product: {
      title,
      body_html: `<p>${escapedDescription}</p>`,
      product_type: shopifyCategory, // Use mapped category instead of raw productType
      status: 'active',
      variants: [
        {
          price: price.toString(),
          inventory_management: null, // Don't track inventory for digital products
          inventory_policy: 'continue', // Allow purchases (unlimited stock)
          requires_shipping: false, // Digital products don't need shipping
          taxable: false,
        },
      ],
      ...(imageUrl && {
        images: [{ src: imageUrl }],
      }),
    },
  };

  try {
    const response = await axios.post(`${BASE_URL}/products.json`, shopifyProductPayload, {
      headers: getHeaders(),
    });

    if (!response.data?.product?.id) {
      throw new Error('Shopify API returned an invalid product response.');
    }

    return String(response.data.product.id);
  } catch (error: any) {
    const errorMessage =
      error.response?.data?.errors || error.message || 'Unknown error';
    console.error(`[Shopify] Failed to create product:`, errorMessage);
    throw new Error(`Failed to create Shopify product: ${JSON.stringify(errorMessage)}`);
  }
}

/**
 * Fetch products from Shopify
 */
export async function fetchProducts() {
  try {
    const response = await axios.get(`${BASE_URL}/products.json`, {
      headers: getHeaders(),
    });
    return response.data.products || [];
  } catch (error: any) {
    console.error('[Shopify] Failed to fetch products:', error.message);
    throw error;
  }
}

/**
 * Fetch orders from Shopify
 */
export async function fetchOrders(status: string = 'any') {
  try {
    const response = await axios.get(
      `${BASE_URL}/orders.json?status=${status}`,
      {
        headers: getHeaders(),
      }
    );
    return response.data.orders || [];
  } catch (error: any) {
    console.error('[Shopify] Failed to fetch orders:', error.message);
    throw error;
  }
}

/**
 * Fetch customers from Shopify
 */
export async function fetchCustomers() {
  try {
    const response = await axios.get(`${BASE_URL}/customers.json`, {
      headers: getHeaders(),
    });
    return response.data.customers || [];
  } catch (error: any) {
    console.error('[Shopify] Failed to fetch customers:', error.message);
    throw error;
  }
}

/**
 * Validate and sanitize input parameters to prevent SSRF
 */
function validateProductId(productId: string): boolean {
  // Shopify product IDs are numeric strings
  // Reject anything that's not a positive integer
  if (!productId || typeof productId !== 'string') {
    return false;
  }
  // Must be numeric only, no special characters
  const numericRegex = /^\d+$/;
  return numericRegex.test(productId.trim());
}

function sanitizeString(input: string, maxLength: number = 100): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }
  // Remove any potentially dangerous characters
  // Allow alphanumeric, underscore, dash, dot
  const sanitized = input.trim().replace(/[^a-zA-Z0-9._-]/g, '');
  if (sanitized.length === 0 || sanitized.length > maxLength) {
    return null;
  }
  return sanitized;
}

/**
 * Fetch product metafields
 * Used for digital goods delivery
 */
export async function fetchProductMetafield(
  productId: string,
  namespace: string = 'digital_goods',
  key: string = 'content'
) {
  // Validate productId to prevent SSRF
  if (!validateProductId(productId)) {
    console.error(
      `[Shopify] Invalid product ID format: ${productId}. Rejecting request.`
    );
    return null;
  }

  // Sanitize namespace and key parameters
  const sanitizedNamespace = sanitizeString(namespace, 50);
  const sanitizedKey = sanitizeString(key, 50);

  if (!sanitizedNamespace || !sanitizedKey) {
    console.error(
      '[Shopify] Invalid namespace or key format. Rejecting request.'
    );
    return null;
  }

  try {
    // Use encodeURIComponent for URL parameters to prevent injection
    const url = `${BASE_URL}/products/${encodeURIComponent(
      productId.trim()
    )}/metafields.json?namespace=${encodeURIComponent(
      sanitizedNamespace
    )}&key=${encodeURIComponent(sanitizedKey)}`;

    const response = await axios.get(url, {
      headers: getHeaders(),
    });

    const metafields = response.data.metafields || [];
    // Use sanitized values for comparison
    const metafield = metafields.find(
      (mf: any) =>
        mf.namespace === sanitizedNamespace && mf.key === sanitizedKey
    );

    return metafield?.value || null;
  } catch (error: any) {
    console.error(
      `[Shopify] Failed to fetch metafield for product ${productId}:`,
      error.message
    );
    return null;
  }
}

/**
 * Validate Shopify configuration
 */
export function validateConfig(): boolean {
  if (!SHOPIFY_STORE_URL || !SHOPIFY_ADMIN_API_TOKEN) {
    console.error(
      '[Shopify] Missing required environment variables: SHOPIFY_STORE_URL and/or SHOPIFY_ADMIN_API_TOKEN'
    );
    return false;
  }
  return true;
}


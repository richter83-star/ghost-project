import axios from 'axios';

/**
 * Unified Shopify Client
 * Standardized configuration and API calls for dracanus-ai.myshopify.com
 */

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

  const shopifyProductPayload = {
    product: {
      title,
      body_html: `<p>${description}</p>`,
      product_type: productType,
      status: 'active',
      variants: [
        {
          price: price.toString(),
          inventory_management: 'shopify',
          inventory_policy: 'deny',
          inventory_quantity: 0,
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
 * Fetch product metafields
 * Used for digital goods delivery
 */
export async function fetchProductMetafield(
  productId: string,
  namespace: string = 'digital_goods',
  key: string = 'content'
) {
  try {
    const response = await axios.get(
      `${BASE_URL}/products/${productId}/metafields.json?namespace=${namespace}&key=${key}`,
      {
        headers: getHeaders(),
      }
    );

    const metafields = response.data.metafields || [];
    const metafield = metafields.find(
      (mf: any) => mf.namespace === namespace && mf.key === key
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


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
  imageBase64?: string; // Base64 encoded image data (from AI generation)
}): Promise<string> {
  const { title, description, productType, price, imageUrl, imageBase64 } = productData;

  // Escape HTML in description to prevent XSS injection attacks
  const escapedDescription = escapeHtml(description);
  
  // Map product type to proper Shopify category
  const shopifyCategory = getBestCategory(title, productType);

  // Build image payload - prefer base64 if available (AI-generated)
  let imagesPayload: any = undefined;
  if (imageBase64) {
    // Use base64 attachment for AI-generated images
    imagesPayload = [{
      attachment: imageBase64,
      filename: `${title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`,
    }];
    console.log(`[Shopify] Using AI-generated image (base64, ${Math.round(imageBase64.length / 1024)}KB)`);
  } else if (imageUrl) {
    // Use URL for placeholder images
    imagesPayload = [{ src: imageUrl }];
    console.log(`[Shopify] Using image URL: ${imageUrl.substring(0, 50)}...`);
  }

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
      ...(imagesPayload && { images: imagesPayload }),
    },
  };

  try {
    const response = await axios.post(`${BASE_URL}/products.json`, shopifyProductPayload, {
      headers: getHeaders(),
      timeout: 60000, // 60 second timeout for large image uploads
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
 * Get product by ID with variants
 */
export async function getProductById(productId: string) {
  if (!validateProductId(productId)) {
    throw new Error(`Invalid product ID: ${productId}`);
  }

  try {
    const response = await axios.get(
      `${BASE_URL}/products/${encodeURIComponent(productId)}.json`,
      { headers: getHeaders() }
    );
    return response.data.product;
  } catch (error: any) {
    console.error(`[Shopify] Failed to get product ${productId}:`, error.message);
    throw error;
  }
}

/**
 * Update product variant price
 * @param productId - Shopify product ID
 * @param newPrice - New price in dollars
 * @param variantId - Optional specific variant ID (uses first variant if not provided)
 * @returns The updated variant data
 */
export async function updateProductPrice(
  productId: string,
  newPrice: number,
  variantId?: string
): Promise<{ success: boolean; oldPrice: number; newPrice: number; variantId: string }> {
  if (!validateProductId(productId)) {
    throw new Error(`Invalid product ID: ${productId}`);
  }

  if (newPrice <= 0 || newPrice > 9999) {
    throw new Error(`Invalid price: ${newPrice}. Must be between 0 and 9999.`);
  }

  try {
    // Get product to find variant ID if not provided
    let targetVariantId = variantId;
    let oldPrice = 0;

    if (!targetVariantId) {
      const product = await getProductById(productId);
      if (!product.variants || product.variants.length === 0) {
        throw new Error(`Product ${productId} has no variants`);
      }
      targetVariantId = String(product.variants[0].id);
      oldPrice = parseFloat(product.variants[0].price) || 0;
    }

    // Update variant price
    const response = await axios.put(
      `${BASE_URL}/variants/${encodeURIComponent(targetVariantId!)}.json`,
      {
        variant: {
          id: targetVariantId,
          price: newPrice.toFixed(2),
        },
      },
      { headers: getHeaders() }
    );

    if (!response.data?.variant?.id) {
      throw new Error('Failed to update variant price');
    }

    console.log(
      `[Shopify] ✅ Updated price for product ${productId}: $${oldPrice} → $${newPrice}`
    );

    return {
      success: true,
      oldPrice,
      newPrice,
      variantId: targetVariantId!,
    };
  } catch (error: any) {
    console.error(`[Shopify] Failed to update price for ${productId}:`, error.message);
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

// =============================================================================
// THEME API - Store Design Agent
// =============================================================================

export interface ShopifyTheme {
  id: number;
  name: string;
  role: 'main' | 'unpublished' | 'demo';
  theme_store_id: number | null;
  previewable: boolean;
  processing: boolean;
  created_at: string;
  updated_at: string;
}

export interface ThemeAsset {
  key: string;
  public_url: string | null;
  value?: string;
  content_type: string;
  size: number;
  created_at: string;
  updated_at: string;
}

export interface ShopifyCollection {
  id: number;
  handle: string;
  title: string;
  body_html: string | null;
  image: { src: string } | null;
  products_count: number;
  published_at: string | null;
}

export interface ShopifyMenu {
  id: number;
  handle: string;
  title: string;
  items: Array<{
    id: number;
    title: string;
    url: string;
    type: string;
    items?: any[];
  }>;
}

/**
 * Get all themes for the store
 */
export async function getThemes(): Promise<ShopifyTheme[]> {
  try {
    const response = await axios.get(`${BASE_URL}/themes.json`, {
      headers: getHeaders(),
    });
    return response.data.themes || [];
  } catch (error: any) {
    console.error('[Shopify] Failed to fetch themes:', error.message);
    throw error;
  }
}

/**
 * Get the currently active (main) theme
 */
export async function getCurrentTheme(): Promise<ShopifyTheme | null> {
  const themes = await getThemes();
  return themes.find((t) => t.role === 'main') || null;
}

/**
 * Get all assets for a theme
 */
export async function getThemeAssets(themeId: number): Promise<ThemeAsset[]> {
  try {
    const response = await axios.get(
      `${BASE_URL}/themes/${themeId}/assets.json`,
      { headers: getHeaders() }
    );
    return response.data.assets || [];
  } catch (error: any) {
    console.error(`[Shopify] Failed to fetch theme assets:`, error.message);
    throw error;
  }
}

/**
 * Get a specific theme asset (file content)
 */
export async function getThemeAsset(
  themeId: number,
  assetKey: string
): Promise<ThemeAsset | null> {
  try {
    const response = await axios.get(
      `${BASE_URL}/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(assetKey)}`,
      { headers: getHeaders() }
    );
    return response.data.asset || null;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return null;
    }
    console.error(`[Shopify] Failed to fetch asset ${assetKey}:`, error.message);
    throw error;
  }
}

/**
 * Update or create a theme asset
 */
export async function updateThemeAsset(
  themeId: number,
  assetKey: string,
  value: string
): Promise<ThemeAsset> {
  try {
    const response = await axios.put(
      `${BASE_URL}/themes/${themeId}/assets.json`,
      {
        asset: {
          key: assetKey,
          value: value,
        },
      },
      { headers: getHeaders() }
    );
    console.log(`[Shopify] ✅ Updated theme asset: ${assetKey}`);
    return response.data.asset;
  } catch (error: any) {
    console.error(`[Shopify] Failed to update asset ${assetKey}:`, error.message);
    throw error;
  }
}

/**
 * Delete a theme asset
 */
export async function deleteThemeAsset(
  themeId: number,
  assetKey: string
): Promise<void> {
  try {
    await axios.delete(
      `${BASE_URL}/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(assetKey)}`,
      { headers: getHeaders() }
    );
    console.log(`[Shopify] ✅ Deleted theme asset: ${assetKey}`);
  } catch (error: any) {
    console.error(`[Shopify] Failed to delete asset ${assetKey}:`, error.message);
    throw error;
  }
}

/**
 * Get all collections (smart + custom)
 */
export async function getCollections(): Promise<ShopifyCollection[]> {
  try {
    const [smartCollections, customCollections] = await Promise.all([
      axios.get(`${BASE_URL}/smart_collections.json`, { headers: getHeaders() }),
      axios.get(`${BASE_URL}/custom_collections.json`, { headers: getHeaders() }),
    ]);
    
    return [
      ...(smartCollections.data.smart_collections || []),
      ...(customCollections.data.custom_collections || []),
    ];
  } catch (error: any) {
    console.error('[Shopify] Failed to fetch collections:', error.message);
    throw error;
  }
}

/**
 * Update a collection
 */
export async function updateCollection(
  collectionId: number,
  data: {
    title?: string;
    body_html?: string;
    image?: { src: string } | { attachment: string };
  }
): Promise<any> {
  try {
    // Try custom collection first, then smart collection
    try {
      const response = await axios.put(
        `${BASE_URL}/custom_collections/${collectionId}.json`,
        { custom_collection: { id: collectionId, ...data } },
        { headers: getHeaders() }
      );
      return response.data.custom_collection;
    } catch {
      const response = await axios.put(
        `${BASE_URL}/smart_collections/${collectionId}.json`,
        { smart_collection: { id: collectionId, ...data } },
        { headers: getHeaders() }
      );
      return response.data.smart_collection;
    }
  } catch (error: any) {
    console.error(`[Shopify] Failed to update collection ${collectionId}:`, error.message);
    throw error;
  }
}

/**
 * Create a custom collection
 */
export async function createCollection(data: {
  title: string;
  body_html?: string;
  sort_order?: string;
  image?: { src: string } | { attachment: string };
}): Promise<any> {
  // Validate title
  const sanitizedTitle = sanitizeString(data.title, 255);
  if (!sanitizedTitle) {
    throw new Error('Collection title is required');
  }
  
  // Sanitize body_html if provided
  const sanitizedBody = data.body_html ? sanitizeString(data.body_html, 16000) : undefined;
  
  try {
    const response = await axios.post(
      `${BASE_URL}/custom_collections.json`,
      { 
        custom_collection: { 
          title: sanitizedTitle,
          body_html: sanitizedBody,
          sort_order: data.sort_order || 'best-selling',
          published: true,
        } 
      },
      { headers: getHeaders() }
    );
    console.log(`[Shopify] Created collection: ${sanitizedTitle}`);
    return response.data.custom_collection;
  } catch (error: any) {
    console.error(`[Shopify] Failed to create collection:`, error.message);
    throw error;
  }
}

/**
 * Add a product to a collection (via Collect)
 */
export async function addProductToCollection(productId: number, collectionId: number): Promise<any> {
  if (!validateProductId(String(productId)) || !validateProductId(String(collectionId))) {
    throw new Error(`Invalid product or collection ID`);
  }
  
  try {
    const response = await axios.post(
      `${BASE_URL}/collects.json`,
      { 
        collect: { 
          product_id: productId,
          collection_id: collectionId,
        } 
      },
      { headers: getHeaders() }
    );
    return response.data.collect;
  } catch (error: any) {
    // If product is already in collection, that's fine
    if (error.response?.status === 422) {
      console.log(`[Shopify] Product ${productId} already in collection ${collectionId}`);
      return null;
    }
    console.error(`[Shopify] Failed to add product to collection:`, error.message);
    throw error;
  }
}

/**
 * Get navigation menus
 */
export async function getMenus(): Promise<ShopifyMenu[]> {
  try {
    const response = await axios.get(`${BASE_URL}/menus.json`, {
      headers: getHeaders(),
    });
    return response.data.menus || [];
  } catch (error: any) {
    // Menus API might not be available on all plans
    console.warn('[Shopify] Menus API not available:', error.message);
    return [];
  }
}

/**
 * Get store metafields (for SEO data, etc.)
 */
export async function getStoreMetafields(): Promise<any[]> {
  try {
    const response = await axios.get(`${BASE_URL}/metafields.json`, {
      headers: getHeaders(),
    });
    return response.data.metafields || [];
  } catch (error: any) {
    console.error('[Shopify] Failed to fetch store metafields:', error.message);
    return [];
  }
}

/**
 * Delete a product image
 */
export async function deleteProductImage(productId: string, imageId: string): Promise<void> {
  try {
    await axios.delete(
      `${BASE_URL}/products/${productId}/images/${imageId}.json`,
      { headers: getHeaders() }
    );
    console.log(`[Shopify] ✅ Deleted image ${imageId} from product ${productId}`);
  } catch (error: any) {
    console.error(`[Shopify] Failed to delete image ${imageId}:`, error.message);
    throw error;
  }
}

/**
 * Replace product images - deletes ALL existing images and sets new primary image
 * This ensures the new image becomes the primary (first) image in Shopify
 */
export async function replaceProductImages(
  productId: string,
  newImageBase64: string,
  deletePlaceholders: boolean = true
): Promise<void> {
  try {
    // Get current product to check existing images
    const product = await axios.get(
      `${BASE_URL}/products/${productId}.json`,
      { headers: getHeaders() }
    );
    
    const existingImages = product.data?.product?.images || [];
    
    // Delete ALL existing images to ensure new image becomes primary
    // In Shopify, the first image in the array is the primary/featured image
    // By deleting all images first, the new image will be the only one (and thus primary)
    if (deletePlaceholders && existingImages.length > 0) {
      console.log(`[Shopify] Deleting ALL ${existingImages.length} existing image(s) from product ${productId}...`);
      
      for (const image of existingImages) {
        const src = (image.src || '').toLowerCase();
        const isPlaceholder = (
          src.includes('picsum') || 
          src.includes('placeholder') || 
          src.includes('unsplash') ||
          src.includes('lorem') ||
          src.includes('nature') ||
          src.includes('seed=') ||
          src.includes('random') ||
          src.includes('placeholder.com') ||
          src.match(/\/\d+\/\d+/) || // Pattern like /800/800 (picsum)
          src.includes('no-image') ||
          src.includes('gift-card')
        );
        
        console.log(`[Shopify] Deleting image ${image.id}${isPlaceholder ? ' (placeholder)' : ' (all images being removed)'}: ${src.substring(0, 60)}...`);
        try {
          await deleteProductImage(productId, String(image.id));
          // Small delay between deletions to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error: any) {
          console.warn(`[Shopify] Could not delete image ${image.id}:`, error.message);
        }
      }
      
      // Wait a bit longer after all deletions to ensure Shopify processes them
      console.log(`[Shopify] Waiting for deletions to process...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Add new image - it will be the only image (and thus primary) or first if others remain
    console.log(`[Shopify] Adding new DRACANUS image to product ${productId}...`);
    const response = await axios.post(
      `${BASE_URL}/products/${productId}/images.json`,
      {
        image: {
          attachment: newImageBase64,
          filename: `dracanus-${productId}.png`,
        },
      },
      { headers: getHeaders() }
    );
    
    if (response.data?.image?.id) {
      console.log(`[Shopify] ✅ Added new primary image (ID: ${response.data.image.id}) to product ${productId}`);
    } else {
      throw new Error('Failed to add new image - no image ID returned');
    }
  } catch (error: any) {
    console.error(`[Shopify] Failed to replace images for product ${productId}:`, error.message);
    throw error;
  }
}

/**
 * Update a product (for SEO, descriptions, etc.)
 */
export async function updateProduct(
  productId: string,
  data: {
    title?: string;
    body_html?: string;
    metafields_global_title_tag?: string;
    metafields_global_description_tag?: string;
    images?: Array<{ src?: string; attachment?: string; alt?: string }>;
  }
): Promise<any> {
  if (!validateProductId(productId)) {
    throw new Error(`Invalid product ID: ${productId}`);
  }

  try {
    const response = await axios.put(
      `${BASE_URL}/products/${encodeURIComponent(productId)}.json`,
      { product: { id: productId, ...data } },
      { headers: getHeaders() }
    );
    console.log(`[Shopify] ✅ Updated product ${productId}`);
    return response.data.product;
  } catch (error: any) {
    console.error(`[Shopify] Failed to update product ${productId}:`, error.message);
    throw error;
  }
}

/**
 * Get shop info (for store-level settings)
 */
export async function getShopInfo(): Promise<any> {
  try {
    const response = await axios.get(`${BASE_URL}/shop.json`, {
      headers: getHeaders(),
    });
    return response.data.shop;
  } catch (error: any) {
    console.error('[Shopify] Failed to fetch shop info:', error.message);
    throw error;
  }
}


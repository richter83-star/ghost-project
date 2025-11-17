import { config } from '../config.js';
import { fetchWithRetry } from '../utils/apiHelper.js';

const { storeUrl, adminToken, apiVersion } = config.shopify;
const shopifyApiUrl = `https://${storeUrl}/admin/api/${apiVersion}/products.json`;

/**
 * Creates a new product in Shopify.
 * @param {object} jobData - The validated product job data.
 * @returns {Promise<string>} - The shopifyProductId.
 */
export async function createProduct(jobData) {
  const { title, description, productType, price, imageUrl } = jobData;

  // This is the payload Shopify expects
  const shopifyProductPayload = {
    product: {
      title: title,
      body_html: `<p>${description}</p>`, // Wrap description in <p> tags
      product_type: productType,
      status: "active", // Set to "active" to publish immediately
      variants: [
        {
          price: price,
          inventory_management: "shopify", // Track inventory
          inventory_policy: "deny", // Don't allow overselling
          inventory_quantity: 0, // Set initial stock
        }
      ],
      images: [
        {
          src: imageUrl
        }
      ]
    }
  };

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': adminToken,
    },
    body: JSON.stringify(shopifyProductPayload),
  };

  try {
    const result = await fetchWithRetry(shopifyApiUrl, options);

    if (!result.product || !result.product.id) {
      throw new Error('Shopify API returned an invalid product response.');
    }

    // Return the new product's ID
    return String(result.product.id);

  } catch (error) {
    console.error(`Shopify API call failed: ${error.message}`);
    throw new Error(`Failed to create Shopify product: ${error.message}`);
  }
}
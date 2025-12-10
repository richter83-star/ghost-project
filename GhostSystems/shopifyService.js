import axios from 'axios';
import config from './config.js';

async function createProduct({ title, description, productType, price, imageUrl = null, imageBase64 = null }) {
  const endpoint = `${config.shopify.storeUrl}/admin/api/${config.shopify.apiVersion}/products.json`;

  const productPayload = {
    product: {
      title,
      body_html: `<p>${description}</p>`,
      product_type: productType,
      status: 'active',
      variants: [
        {
          price: price.toString(),
          requires_shipping: false,
          inventory_management: null,
        },
      ],
    },
  };

  if (imageUrl) {
    productPayload.product.images = [{ src: imageUrl }];
  } else if (imageBase64) {
    // Shopify supports base64 attachments via the REST API
    productPayload.product.images = [
      {
        attachment: imageBase64,
      },
    ];
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': config.shopify.adminToken,
  };

  const response = await axios.post(endpoint, productPayload, { headers });
  const shopifyProductId = response?.data?.product?.id;
  if (!shopifyProductId) {
    throw new Error('Shopify did not return a product ID');
  }
  return shopifyProductId;
}

export { createProduct };
export default { createProduct };

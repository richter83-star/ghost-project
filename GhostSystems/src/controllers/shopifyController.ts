// src/controllers/shopifyController.ts
import { fetchProducts, fetchOrders, fetchCustomers, validateConfig } from '../lib/shopify.js';

export async function fetchShopifyData() {
  console.log('[FleetController] Syncing Shopify store data...');

  // Validate configuration
  if (!validateConfig()) {
    return {
      ok: false,
      error: 'Shopify configuration is missing or invalid',
    };
  }

  try {
    // Fetch all data using unified Shopify client
    const [products, orders, customers] = await Promise.all([
      fetchProducts(),
      fetchOrders('any'),
      fetchCustomers(),
    ]);

    console.log(`✅ Synced ${products.length} products`);
    console.log(`✅ Synced ${orders.length} orders`);
    console.log(`✅ Synced ${customers.length} customers`);

    return {
      ok: true,
      stats: {
        products: products.length,
        orders: orders.length,
        customers: customers.length,
      },
    };
  } catch (err: any) {
    console.error('❌ Shopify sync failed:', err.message);
    return { ok: false, error: err.message };
  }
}

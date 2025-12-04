/**
 * Store Design Agent - Analytics Collector
 * 
 * Collects and analyzes store data to inform design recommendations.
 */

import { decode } from 'html-entities';
import {
  fetchProducts,
  fetchOrders,
  fetchCustomers,
  getCurrentTheme,
  getThemeAssets,
  getCollections,
  getShopInfo,
  validateConfig,
} from '../shopify.js';
import { StoreAnalytics } from './types.js';

/**
 * Safely strip HTML tags and decode entities from a string
 * This prevents incomplete multi-character sanitization vulnerabilities
 */
function stripHtml(html: string): string {
  if (!html) return '';
  // First decode HTML entities
  const decoded = decode(html, { level: 'html5' });
  // Then remove all HTML tags (including malformed ones)
  let text = decoded;
  // Repeatedly strip tags until none remain (handles nested/malformed tags)
  let previous = '';
  while (previous !== text) {
    previous = text;
    text = text.replace(/<[^>]*>|<[^>]*$/g, '');
  }
  // Remove any remaining angle brackets that might be part of incomplete tags
  text = text.replace(/[<>]/g, '');
  return text.trim();
}

/**
 * Collect comprehensive store analytics
 */
export async function collectStoreAnalytics(): Promise<StoreAnalytics | null> {
  if (!validateConfig()) {
    console.error('[DesignAgent] Shopify not configured');
    return null;
  }

  console.log('[DesignAgent] 📊 Collecting store analytics...');

  try {
    // Fetch all data in parallel
    const [products, orders, customers, theme, collections] = await Promise.all([
      fetchProducts().catch(() => []),
      fetchOrders('any').catch(() => []),
      fetchCustomers().catch(() => []),
      getCurrentTheme().catch(() => null),
      getCollections().catch(() => []),
    ]);

    // Get theme assets if we have a theme
    let themeAssets: any[] = [];
    if (theme) {
      themeAssets = await getThemeAssets(theme.id).catch(() => []);
    }

    // Analyze products
    const productsWithImages = products.filter((p: any) => p.images && p.images.length > 0);
    const productsWithDescriptions = products.filter((p: any) => {
      const text = stripHtml(p.body_html || '');
      return text.length >= 50;
    });

    const avgDescriptionLength = products.length > 0
      ? products.reduce((sum: number, p: any) => {
          return sum + stripHtml(p.body_html || '').length;
        }, 0) / products.length
      : 0;

    // Analyze SEO
    const productsWithMeta = products.filter((p: any) => 
      p.metafields_global_title_tag || p.metafields_global_description_tag
    ).length;

    const seoIssues: string[] = [];
    const productsMissingMeta = products.length - productsWithMeta;
    if (productsMissingMeta > 0) {
      seoIssues.push(`${productsMissingMeta} products missing meta tags`);
    }
    
    const shortTitles = products.filter((p: any) => (p.title || '').length < 20).length;
    if (shortTitles > 0) {
      seoIssues.push(`${shortTitles} products have short titles (<20 chars)`);
    }

    const shortDescriptions = products.filter((p: any) => {
      return stripHtml(p.body_html || '').length < 100;
    }).length;
    if (shortDescriptions > 0) {
      seoIssues.push(`${shortDescriptions} products have short descriptions (<100 chars)`);
    }

    // Analyze collections
    const collectionsWithImages = collections.filter((c: any) => c.image?.src).length;
    const collectionsWithDescriptions = collections.filter((c: any) => {
      return stripHtml(c.body_html || '').length > 0;
    }).length;

    // Calculate sales by product
    const salesByProduct: Record<string, { sales: number; revenue: number }> = {};
    orders.forEach((order: any) => {
      (order.line_items || []).forEach((item: any) => {
        const productId = String(item.product_id);
        if (!salesByProduct[productId]) {
          salesByProduct[productId] = { sales: 0, revenue: 0 };
        }
        salesByProduct[productId].sales += item.quantity;
        salesByProduct[productId].revenue += parseFloat(item.price) * item.quantity;
      });
    });

    // Top performers (by revenue)
    const topPerformers = Object.entries(salesByProduct)
      .map(([productId, data]) => {
        const product = products.find((p: any) => String(p.id) === productId);
        return {
          id: productId,
          title: product?.title || 'Unknown',
          sales: data.sales,
          revenue: data.revenue,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Underperformers (products with no sales)
    const underperformers = products
      .filter((p: any) => !salesByProduct[String(p.id)])
      .slice(0, 10)
      .map((p: any) => ({
        id: String(p.id),
        title: p.title,
        views: 0, // Would need analytics API for actual views
        sales: 0,
      }));

    // Customer analysis
    const totalRevenue = orders.reduce((sum: number, o: any) => 
      sum + parseFloat(o.total_price || 0), 0
    );
    const avgOrderValue = orders.length > 0 ? totalRevenue / orders.length : 0;

    // Check for custom CSS/JS in theme
    const customCSS = themeAssets.some((a: any) => 
      a.key.includes('custom') && a.key.endsWith('.css')
    );
    const customJS = themeAssets.some((a: any) => 
      a.key.includes('custom') && a.key.endsWith('.js')
    );

    const analytics: StoreAnalytics = {
      pageViews: {
        total: 0, // Would need analytics API
        byPage: {},
        trend: 'stable',
      },
      conversionFunnel: {
        homepage: 0,
        collection: 0,
        product: 0,
        cart: 0,
        checkout: 0,
        purchase: orders.length,
        overallRate: 0,
      },
      products: {
        total: products.length,
        withImages: productsWithImages.length,
        withDescriptions: productsWithDescriptions.length,
        avgDescriptionLength: Math.round(avgDescriptionLength),
        topPerformers,
        underperformers,
      },
      seo: {
        productsWithMeta,
        productsMissingMeta,
        collectionsWithMeta: 0, // Would need to check each collection
        avgTitleLength: products.length > 0
          ? Math.round(products.reduce((sum: number, p: any) => sum + (p.title || '').length, 0) / products.length)
          : 0,
        avgDescriptionLength: Math.round(avgDescriptionLength),
        issues: seoIssues,
      },
      customers: {
        total: customers.length,
        returning: customers.filter((c: any) => c.orders_count > 1).length,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
        topLocations: getTopLocations(customers),
      },
      theme: {
        name: theme?.name || 'Unknown',
        totalAssets: themeAssets.length,
        customCSS,
        customJS,
        lastModified: theme?.updated_at || '',
      },
      collections: {
        total: collections.length,
        withImages: collectionsWithImages,
        withDescriptions: collectionsWithDescriptions,
        avgProductCount: collections.length > 0
          ? Math.round(collections.reduce((sum: number, c: any) => sum + (c.products_count || 0), 0) / collections.length)
          : 0,
      },
      collectedAt: new Date(),
    };

    console.log('[DesignAgent] ✅ Analytics collected:', {
      products: analytics.products.total,
      orders: orders.length,
      customers: analytics.customers.total,
      collections: analytics.collections.total,
      seoIssues: analytics.seo.issues.length,
    });

    return analytics;
  } catch (error: any) {
    console.error('[DesignAgent] ❌ Failed to collect analytics:', error.message);
    return null;
  }
}

/**
 * Get top customer locations
 */
function getTopLocations(customers: any[]): string[] {
  const locations: Record<string, number> = {};
  
  customers.forEach((c) => {
    const country = c.default_address?.country || 'Unknown';
    locations[country] = (locations[country] || 0) + 1;
  });

  return Object.entries(locations)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([country]) => country);
}

/**
 * Compare two analytics snapshots to identify trends
 */
export function compareAnalytics(
  current: StoreAnalytics,
  previous: StoreAnalytics
): {
  productGrowth: number;
  orderGrowth: number;
  customerGrowth: number;
  seoImprovement: number;
} {
  return {
    productGrowth: calculateGrowth(current.products.total, previous.products.total),
    orderGrowth: calculateGrowth(
      current.conversionFunnel.purchase,
      previous.conversionFunnel.purchase
    ),
    customerGrowth: calculateGrowth(current.customers.total, previous.customers.total),
    seoImprovement: calculateGrowth(
      current.seo.productsWithMeta,
      previous.seo.productsWithMeta
    ),
  };
}

function calculateGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}


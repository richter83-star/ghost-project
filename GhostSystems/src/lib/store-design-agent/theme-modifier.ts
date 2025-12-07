/**
 * Store Design Agent - Theme Modifier
 * 
 * Applies design changes to Shopify theme with backup/rollback support.
 */

import { decode } from 'html-entities';
import {
  getCurrentTheme,
  getThemeAsset,
  updateThemeAsset,
  deleteThemeAsset,
  updateProduct,
  updateCollection,
  fetchProducts,
  ShopifyTheme,
  ThemeAsset,
} from '../shopify.js';
import { saveThemeBackup, getThemeBackup } from './approval-queue.js';
import { DesignRecommendation, ThemeBackup } from './types.js';
import { generateCopy } from './designer.js';

/**
 * Safely strip HTML tags and decode entities from a string
 */
function stripHtml(html: string): string {
  if (!html) return '';
  const decoded = decode(html, { level: 'html5' });
  let text = decoded;
  let previous = '';
  while (previous !== text) {
    previous = text;
    text = text.replace(/<[^>]*>|<[^>]*$/g, '');
  }
  text = text.replace(/[<>]/g, '');
  return text.trim();
}

/**
 * Apply a design recommendation
 */
export async function applyRecommendation(
  recommendation: DesignRecommendation
): Promise<{ success: boolean; backupId?: string; error?: string }> {
  console.log(`[DesignAgent] 🔧 Applying recommendation: ${recommendation.title}`);

  try {
    const { implementation } = recommendation;

    switch (implementation.type) {
      case 'theme_asset':
        return await applyThemeAssetChange(recommendation);
      
      case 'product':
        return await applyProductChange(recommendation);
      
      case 'collection':
        return await applyCollectionChange(recommendation);
      
      case 'metafield':
        return await applyMetafieldChange(recommendation);
      
      default:
        return { success: false, error: `Unknown implementation type: ${implementation.type}` };
    }
  } catch (error: any) {
    console.error('[DesignAgent] Failed to apply recommendation:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Apply a theme asset change with backup
 */
async function applyThemeAssetChange(
  recommendation: DesignRecommendation
): Promise<{ success: boolean; backupId?: string; error?: string }> {
  const theme = await getCurrentTheme();
  if (!theme) {
    return { success: false, error: 'Could not get current theme' };
  }

  const { target, changes } = recommendation.implementation;

  // Get current asset for backup
  const currentAsset = await getThemeAsset(theme.id, target);
  
  // Create backup
  const backupId = await saveThemeBackup({
    themeId: theme.id,
    themeName: theme.name,
    assets: currentAsset ? [{ key: target, value: currentAsset.value || '' }] : [],
    createdAt: new Date(),
    reason: `Before applying: ${recommendation.title}`,
  });

  if (!backupId) {
    return { success: false, error: 'Failed to create backup' };
  }

  // Apply changes based on action type
  const action = changes.action as string;

  if (action === 'update_css') {
    const newCSS = changes.css as string;
    await updateThemeAsset(theme.id, target, newCSS);
  } else if (action === 'update_liquid') {
    const newLiquid = changes.liquid as string;
    await updateThemeAsset(theme.id, target, newLiquid);
  } else if (action === 'add_custom_css') {
    // Append to existing custom CSS or create new
    const existingCSS = currentAsset?.value || '';
    const newCSS = `${existingCSS}\n\n/* Added by Store Design Agent */\n${changes.css}`;
    await updateThemeAsset(theme.id, 'assets/custom.css', newCSS);
  }

  console.log(`[DesignAgent] ✅ Applied theme change: ${recommendation.title}`);
  return { success: true, backupId };
}

/**
 * Apply product changes (SEO, descriptions, images)
 */
async function applyProductChange(
  recommendation: DesignRecommendation
): Promise<{ success: boolean; backupId?: string; error?: string }> {
  const { target, changes } = recommendation.implementation;
  const action = changes.action as string;

  if (action === 'generate_meta_descriptions') {
    return await generateProductMetas();
  } else if (action === 'enhance_descriptions') {
    return await enhanceProductDescriptions(changes.minLength as number || 300);
  } else if (action === 'optimize_underperformers') {
    const productIds = changes.products as string[];
    return await optimizeProducts(productIds);
  } else if (target !== 'bulk') {
    // Single product update
    await updateProduct(target, changes as any);
    return { success: true };
  }

  return { success: false, error: 'Unknown product action' };
}

/**
 * Generate meta descriptions for products missing them
 */
async function generateProductMetas(): Promise<{ success: boolean; error?: string }> {
  console.log('[DesignAgent] Generating meta descriptions...');
  
  const products = await fetchProducts();
  let updated = 0;

  for (const product of products) {
    if (!product.metafields_global_description_tag) {
      const metaDescription = await generateCopy('meta_description', {
        title: product.title,
        productType: product.product_type,
      });

      if (metaDescription) {
        try {
          await updateProduct(String(product.id), {
            metafields_global_description_tag: metaDescription,
          });
          updated++;
          console.log(`[DesignAgent] ✅ Added meta for: ${product.title}`);
        } catch (error) {
          console.warn(`[DesignAgent] Failed to update meta for ${product.id}`);
        }
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(`[DesignAgent] ✅ Generated ${updated} meta descriptions`);
  return { success: true };
}

/**
 * Enhance product descriptions that are too short
 */
async function enhanceProductDescriptions(
  minLength: number
): Promise<{ success: boolean; error?: string }> {
  console.log('[DesignAgent] Enhancing product descriptions...');
  
  const products = await fetchProducts();
  let updated = 0;

  for (const product of products) {
    const currentLength = stripHtml(product.body_html || '').length;
    
    if (currentLength < minLength) {
      const enhancedDescription = await generateCopy('product_description', {
        title: product.title,
        productType: product.product_type,
        existingContent: product.body_html,
      });

      if (enhancedDescription) {
        try {
          await updateProduct(String(product.id), {
            body_html: enhancedDescription,
          });
          updated++;
          console.log(`[DesignAgent] ✅ Enhanced description for: ${product.title}`);
        } catch (error) {
          console.warn(`[DesignAgent] Failed to enhance ${product.id}`);
        }
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  console.log(`[DesignAgent] ✅ Enhanced ${updated} descriptions`);
  return { success: true };
}

/**
 * Optimize underperforming products
 */
async function optimizeProducts(
  productIds: string[]
): Promise<{ success: boolean; error?: string }> {
  console.log(`[DesignAgent] Optimizing ${productIds.length} products...`);
  
  const products = await fetchProducts();
  let updated = 0;

  for (const productId of productIds) {
    const product = products.find((p: any) => String(p.id) === productId);
    if (!product) continue;

    // Generate better title if too generic
    // Generate better description
    // Suggest price adjustment (logged, not applied)

    const enhancedDescription = await generateCopy('product_description', {
      title: product.title,
      productType: product.product_type,
      existingContent: product.body_html,
    });

    const metaDescription = await generateCopy('meta_description', {
      title: product.title,
      productType: product.product_type,
    });

    if (enhancedDescription || metaDescription) {
      try {
        const updates: any = {};
        if (enhancedDescription) updates.body_html = enhancedDescription;
        if (metaDescription) updates.metafields_global_description_tag = metaDescription;
        
        await updateProduct(productId, updates);
        updated++;
        console.log(`[DesignAgent] ✅ Optimized: ${product.title}`);
      } catch (error) {
        console.warn(`[DesignAgent] Failed to optimize ${productId}`);
      }
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log(`[DesignAgent] ✅ Optimized ${updated} products`);
  return { success: true };
}

/**
 * Apply collection changes
 */
async function applyCollectionChange(
  recommendation: DesignRecommendation
): Promise<{ success: boolean; backupId?: string; error?: string }> {
  const { target, changes } = recommendation.implementation;
  const action = changes.action as string;

  if (action === 'generate_collection_descriptions') {
    try {
      const { getCollections, updateCollection } = await import('../shopify.js');
      const collections = await getCollections();
      
      // Filter collections that need descriptions (missing or too short)
      const collectionsNeedingDescriptions = collections.filter((collection: any) => {
        const currentDesc = stripHtml(collection.body_html || collection.description || '');
        return !currentDesc || currentDesc.length < 100;
      });

      if (collectionsNeedingDescriptions.length === 0) {
        console.log('[DesignAgent] All collections already have descriptions');
        return { success: true };
      }

      console.log(`[DesignAgent] Generating descriptions for ${collectionsNeedingDescriptions.length} collections`);

      let updated = 0;
      for (const collection of collectionsNeedingDescriptions) {
        try {
          // Generate AI description for collection
          const collectionTitle = collection.title || 'Collection';
          const productCount = collection.products_count || 0;
          
          const description = await generateCopy(
            'collection_description',
            {
              collection_title: collectionTitle,
              product_count: productCount,
              collection_type: collection.sort_order ? 'smart' : 'custom',
            }
          );

          if (description && description.length >= 100) {
            // Update collection with new description
            await updateCollection(collection.id, {
              body_html: `<p>${description.replace(/\n/g, '</p><p>')}</p>`,
            });
            
            updated++;
            console.log(`[DesignAgent] ✅ Generated description for collection: ${collectionTitle}`);
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            console.warn(`[DesignAgent] ⚠️ Generated description too short for: ${collectionTitle}`);
          }
        } catch (error: any) {
          console.error(`[DesignAgent] ❌ Failed to generate description for collection ${collection.id}:`, error.message);
        }
      }

      console.log(`[DesignAgent] ✅ Updated ${updated} collection descriptions`);
      return { success: true };
    } catch (error: any) {
      console.error('[DesignAgent] Failed to generate collection descriptions:', error.message);
      return { success: false, error: error.message };
    }
  }

  return { success: false, error: 'Unknown collection action' };
}

/**
 * Apply metafield changes
 */
async function applyMetafieldChange(
  recommendation: DesignRecommendation
): Promise<{ success: boolean; backupId?: string; error?: string }> {
  const { target, changes } = recommendation.implementation;
  const action = changes.action as string;
  const metafieldData = changes.metafield as {
    namespace: string;
    key: string;
    value: string;
    type: string;
  };

  if (!metafieldData) {
    return { success: false, error: 'Metafield data is required' };
  }

  try {
    const axios = (await import('axios')).default;
    const BASE_URL = `https://${process.env.SHOPIFY_STORE_URL?.replace(/^https?:\/\//, '').replace(/\/$/, '')}/admin/api/${process.env.SHOPIFY_API_VERSION || '2025-01'}`;
    
    function getHeaders() {
      return {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_TOKEN || '',
      };
    }

    // Determine target type (product, collection, or store)
    const targetType = target.includes('product') ? 'product' : 
                      target.includes('collection') ? 'collection' : 
                      'store';

    if (targetType === 'product') {
      // Extract product ID from target
      const productId = target.replace('product:', '').trim();
      
      if (!productId || !/^\d+$/.test(productId)) {
        return { success: false, error: 'Invalid product ID' };
      }

      // Check if metafield exists
      const existingMetafield = await axios.get(
        `${BASE_URL}/products/${productId}/metafields.json?namespace=${encodeURIComponent(metafieldData.namespace)}&key=${encodeURIComponent(metafieldData.key)}`,
        { headers: getHeaders() }
      ).catch(() => ({ data: { metafields: [] } }));

      const metafields = existingMetafield.data?.metafields || [];
      const existing = metafields.find((mf: any) => 
        mf.namespace === metafieldData.namespace && mf.key === metafieldData.key
      );

      if (existing) {
        // Update existing metafield
        await axios.put(
          `${BASE_URL}/metafields/${existing.id}.json`,
          {
            metafield: {
              id: existing.id,
              value: metafieldData.value,
              type: metafieldData.type || existing.type,
            },
          },
          { headers: getHeaders() }
        );
        console.log(`[DesignAgent] ✅ Updated metafield ${metafieldData.namespace}.${metafieldData.key} for product ${productId}`);
      } else {
        // Create new metafield
        await axios.post(
          `${BASE_URL}/products/${productId}/metafields.json`,
          {
            metafield: {
              namespace: metafieldData.namespace,
              key: metafieldData.key,
              value: metafieldData.value,
              type: metafieldData.type || 'single_line_text_field',
              owner_resource: 'product',
              owner_id: productId,
            },
          },
          { headers: getHeaders() }
        );
        console.log(`[DesignAgent] ✅ Created metafield ${metafieldData.namespace}.${metafieldData.key} for product ${productId}`);
      }
    } else if (targetType === 'collection') {
      const collectionId = target.replace('collection:', '').trim();
      
      if (!collectionId || !/^\d+$/.test(collectionId)) {
        return { success: false, error: 'Invalid collection ID' };
      }

      // Check if metafield exists
      const existingMetafield = await axios.get(
        `${BASE_URL}/collections/${collectionId}/metafields.json?namespace=${encodeURIComponent(metafieldData.namespace)}&key=${encodeURIComponent(metafieldData.key)}`,
        { headers: getHeaders() }
      ).catch(() => ({ data: { metafields: [] } }));

      const metafields = existingMetafield.data?.metafields || [];
      const existing = metafields.find((mf: any) => 
        mf.namespace === metafieldData.namespace && mf.key === metafieldData.key
      );

      if (existing) {
        await axios.put(
          `${BASE_URL}/metafields/${existing.id}.json`,
          {
            metafield: {
              id: existing.id,
              value: metafieldData.value,
              type: metafieldData.type || existing.type,
            },
          },
          { headers: getHeaders() }
        );
        console.log(`[DesignAgent] ✅ Updated metafield ${metafieldData.namespace}.${metafieldData.key} for collection ${collectionId}`);
      } else {
        await axios.post(
          `${BASE_URL}/collections/${collectionId}/metafields.json`,
          {
            metafield: {
              namespace: metafieldData.namespace,
              key: metafieldData.key,
              value: metafieldData.value,
              type: metafieldData.type || 'single_line_text_field',
              owner_resource: 'collection',
              owner_id: collectionId,
            },
          },
          { headers: getHeaders() }
        );
        console.log(`[DesignAgent] ✅ Created metafield ${metafieldData.namespace}.${metafieldData.key} for collection ${collectionId}`);
      }
    } else {
      // Store-level metafield
      const existingMetafield = await axios.get(
        `${BASE_URL}/metafields.json?namespace=${encodeURIComponent(metafieldData.namespace)}&key=${encodeURIComponent(metafieldData.key)}&owner_resource=shop`,
        { headers: getHeaders() }
      ).catch(() => ({ data: { metafields: [] } }));

      const metafields = existingMetafield.data?.metafields || [];
      const existing = metafields.find((mf: any) => 
        mf.namespace === metafieldData.namespace && mf.key === metafieldData.key
      );

      if (existing) {
        await axios.put(
          `${BASE_URL}/metafields/${existing.id}.json`,
          {
            metafield: {
              id: existing.id,
              value: metafieldData.value,
              type: metafieldData.type || existing.type,
            },
          },
          { headers: getHeaders() }
        );
        console.log(`[DesignAgent] ✅ Updated store metafield ${metafieldData.namespace}.${metafieldData.key}`);
      } else {
        await axios.post(
          `${BASE_URL}/metafields.json`,
          {
            metafield: {
              namespace: metafieldData.namespace,
              key: metafieldData.key,
              value: metafieldData.value,
              type: metafieldData.type || 'single_line_text_field',
              owner_resource: 'shop',
            },
          },
          { headers: getHeaders() }
        );
        console.log(`[DesignAgent] ✅ Created store metafield ${metafieldData.namespace}.${metafieldData.key}`);
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error('[DesignAgent] Failed to apply metafield change:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Revert a change using backup
 */
export async function revertChange(
  backupId: string
): Promise<{ success: boolean; error?: string }> {
  console.log(`[DesignAgent] 🔄 Reverting change using backup: ${backupId}`);

  const backup = await getThemeBackup(backupId);
  if (!backup) {
    return { success: false, error: 'Backup not found' };
  }

  try {
    for (const asset of backup.assets) {
      await updateThemeAsset(backup.themeId, asset.key, asset.value);
      console.log(`[DesignAgent] ✅ Reverted: ${asset.key}`);
    }
    return { success: true };
  } catch (error: any) {
    console.error('[DesignAgent] Revert failed:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Preview a change without applying
 */
export async function previewChange(
  recommendation: DesignRecommendation
): Promise<{
  before: string;
  after: string;
  affectedFiles: string[];
}> {
  const { implementation } = recommendation;
  
  // Get current state
  let before = '';
  if (implementation.type === 'theme_asset') {
    const theme = await getCurrentTheme();
    if (theme) {
      const asset = await getThemeAsset(theme.id, implementation.target);
      before = asset?.value || '(file does not exist)';
    }
  }

  // Generate preview of changes
  const after = JSON.stringify(implementation.changes, null, 2);

  return {
    before,
    after,
    affectedFiles: [implementation.target],
  };
}


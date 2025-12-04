/**
 * Store Design Agent - Theme Modifier
 * 
 * Applies design changes to Shopify theme with backup/rollback support.
 */

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
    const currentLength = (product.body_html || '').replace(/<[^>]*>/g, '').length;
    
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
    // TODO: Implement collection description generation
    console.log('[DesignAgent] Collection description generation not yet implemented');
    return { success: true };
  }

  return { success: false, error: 'Unknown collection action' };
}

/**
 * Apply metafield changes
 */
async function applyMetafieldChange(
  recommendation: DesignRecommendation
): Promise<{ success: boolean; backupId?: string; error?: string }> {
  // TODO: Implement metafield changes
  console.log('[DesignAgent] Metafield changes not yet implemented');
  return { success: true };
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


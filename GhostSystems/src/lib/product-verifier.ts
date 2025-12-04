/**
 * Product Verification Service
 * 
 * Verifies that products have real, deliverable content before publishing.
 * Auto-generates missing content when needed.
 */

import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import {
  generateProductContent,
  GeneratedContent,
  PromptPackContent,
  AutomationKitContent,
  BundleContent,
} from './content-generator.js';

// ============================================================================
// TYPES
// ============================================================================

export interface ProductRequirements {
  hasContent: boolean;
  hasDescription: boolean;
  hasImage: boolean;
  hasValidPrice: boolean;
  contentType: 'prompt_pack' | 'automation_kit' | 'bundle' | 'unknown';
  minimumPrompts?: number;
  minimumNodes?: number;
}

export interface VerificationResult {
  isValid: boolean;
  productId: string;
  title: string;
  issues: string[];
  requirements: ProductRequirements;
  content?: GeneratedContent;
  fixable: boolean;
}

export interface ProductData {
  id?: string;
  title: string;
  description?: string;
  productType?: string;
  product_type?: string;
  price?: number;
  price_usd?: number;
  imageUrl?: string;
  images?: Array<{ src: string }>;
  hasContent?: boolean;
  contentUrl?: string;
  content?: any;
}

// ============================================================================
// REQUIREMENTS DEFINITIONS
// ============================================================================

const PRODUCT_REQUIREMENTS: Record<string, Partial<ProductRequirements>> = {
  prompt_pack: {
    minimumPrompts: 10,
    contentType: 'prompt_pack',
  },
  automation_kit: {
    minimumNodes: 3,
    contentType: 'automation_kit',
  },
  bundle: {
    contentType: 'bundle',
  },
};

// ============================================================================
// VERIFICATION FUNCTIONS
// ============================================================================

/**
 * Get content type from product type string
 */
export function getContentType(productType: string): 'prompt_pack' | 'automation_kit' | 'bundle' | 'unknown' {
  const normalized = productType.toLowerCase().replace(/[_\s-]+/g, '_');
  
  if (normalized.includes('prompt') || normalized.includes('pack')) {
    return 'prompt_pack';
  }
  if (normalized.includes('automation') || normalized.includes('kit') || normalized.includes('workflow')) {
    return 'automation_kit';
  }
  if (normalized.includes('bundle')) {
    return 'bundle';
  }
  
  return 'unknown';
}

/**
 * Get requirements for a product type
 */
export function getRequiredContent(productType: string): ProductRequirements {
  const contentType = getContentType(productType);
  const typeRequirements = PRODUCT_REQUIREMENTS[contentType] || {};
  
  return {
    hasContent: true,
    hasDescription: true,
    hasImage: true,
    hasValidPrice: true,
    contentType,
    ...typeRequirements,
  };
}

/**
 * Verify if product content meets requirements
 */
export function verifyContent(
  content: GeneratedContent | undefined,
  requirements: ProductRequirements
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (!content) {
    issues.push('No content generated');
    return { valid: false, issues };
  }

  if (requirements.contentType === 'prompt_pack') {
    const promptContent = content.content as PromptPackContent;
    if (!promptContent.prompts || promptContent.prompts.length < (requirements.minimumPrompts || 10)) {
      issues.push(`Insufficient prompts: ${promptContent.prompts?.length || 0}/${requirements.minimumPrompts || 10}`);
    }
    if (!promptContent.usageGuide || promptContent.usageGuide.length < 100) {
      issues.push('Missing or insufficient usage guide');
    }
  }

  if (requirements.contentType === 'automation_kit') {
    const kitContent = content.content as AutomationKitContent;
    if (!kitContent.workflow?.nodes || kitContent.workflow.nodes.length < (requirements.minimumNodes || 3)) {
      issues.push(`Insufficient workflow nodes: ${kitContent.workflow?.nodes?.length || 0}/${requirements.minimumNodes || 3}`);
    }
    if (!kitContent.setupGuide || kitContent.setupGuide.length < 200) {
      issues.push('Missing or insufficient setup guide');
    }
  }

  if (requirements.contentType === 'bundle') {
    const bundleContent = content.content as BundleContent;
    if (!bundleContent.items || bundleContent.items.length < 2) {
      issues.push('Bundle must contain at least 2 items');
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Verify a product has all required attributes and content
 */
export async function verifyProduct(product: ProductData): Promise<VerificationResult> {
  const issues: string[] = [];
  const productType = product.productType || product.product_type || 'unknown';
  const requirements = getRequiredContent(productType);
  const productId = product.id || 'unknown';
  
  // Check basic requirements
  if (!product.title || product.title.trim().length < 5) {
    issues.push('Missing or too short title');
  }

  if (!product.description || product.description.trim().length < 100) {
    issues.push('Missing or too short description (need 100+ chars)');
  }

  const price = product.price || product.price_usd;
  if (!price || price <= 0) {
    issues.push('Missing or invalid price');
  }

  // Check for images
  const hasImage = !!product.imageUrl || (product.images && product.images.length > 0);
  if (!hasImage) {
    issues.push('Missing product image');
  }

  // Check for content
  if (!product.hasContent && !product.content && !product.contentUrl) {
    issues.push('No deliverable content attached');
  }

  // If content exists, verify it meets requirements
  let content: GeneratedContent | undefined;
  if (product.content) {
    const contentVerification = verifyContent(product.content, requirements);
    if (!contentVerification.valid) {
      issues.push(...contentVerification.issues);
    }
    content = product.content;
  }

  const isValid = issues.length === 0;
  const fixable = issues.some(i => 
    i.includes('content') || 
    i.includes('description') ||
    i.includes('prompts') ||
    i.includes('nodes') ||
    i.includes('guide')
  );

  return {
    isValid,
    productId,
    title: product.title || 'Unknown',
    issues,
    requirements,
    content,
    fixable,
  };
}

/**
 * Generate missing content for a product
 */
export async function generateMissingContent(
  product: ProductData
): Promise<GeneratedContent> {
  const productType = product.productType || product.product_type || 'prompt_pack';
  
  console.log(`[ProductVerifier] Generating content for: ${product.title}`);
  
  const content = await generateProductContent(productType, product.title, {
    theme: extractThemeFromProduct(product),
    promptCount: 15,
  });
  
  console.log(`[ProductVerifier] Generated ${content.type} content`);
  
  return content;
}

/**
 * Verify and fix a product - generates missing content if needed
 */
export async function verifyAndFix(product: ProductData): Promise<{
  result: VerificationResult;
  fixed: boolean;
  content?: GeneratedContent;
}> {
  // First verification
  let result = await verifyProduct(product);
  
  if (result.isValid) {
    return { result, fixed: false };
  }
  
  // Try to fix if possible
  if (result.fixable) {
    try {
      const content = await generateMissingContent(product);
      
      // Update product with generated content
      const updatedProduct: ProductData = {
        ...product,
        content,
        hasContent: true,
      };
      
      // If description is missing, generate one from content
      if (!product.description || product.description.length < 100) {
        updatedProduct.description = generateDescriptionFromContent(content);
      }
      
      // Re-verify
      result = await verifyProduct(updatedProduct);
      
      return { result, fixed: true, content };
    } catch (error: any) {
      console.error(`[ProductVerifier] Failed to fix product: ${error.message}`);
      result.issues.push(`Auto-fix failed: ${error.message}`);
    }
  }
  
  return { result, fixed: false };
}

/**
 * Batch verify multiple products
 */
export async function verifyProducts(products: ProductData[]): Promise<{
  total: number;
  valid: number;
  invalid: number;
  fixable: number;
  results: VerificationResult[];
}> {
  const results: VerificationResult[] = [];
  
  for (const product of products) {
    const result = await verifyProduct(product);
    results.push(result);
  }
  
  return {
    total: products.length,
    valid: results.filter(r => r.isValid).length,
    invalid: results.filter(r => !r.isValid).length,
    fixable: results.filter(r => !r.isValid && r.fixable).length,
    results,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function extractThemeFromProduct(product: ProductData): string {
  const title = product.title || '';
  const description = product.description || '';
  const productType = product.productType || product.product_type || '';
  
  // Try to extract theme from title
  const cleanTitle = title
    .replace(/prompt(s)?|pack|kit|bundle|automation|workflow/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (cleanTitle.length > 5) {
    return cleanTitle;
  }
  
  // Try to extract from description
  const firstSentence = description.split('.')[0]?.trim();
  if (firstSentence && firstSentence.length > 10) {
    return firstSentence.slice(0, 50);
  }
  
  return 'Professional Digital Products';
}

function generateDescriptionFromContent(content: GeneratedContent): string {
  if (content.type === 'prompt_pack') {
    const pack = content.content as PromptPackContent;
    return `${pack.title} - A premium collection of ${pack.totalPrompts} professionally crafted AI prompts for ${pack.theme}. ${pack.usageGuide.slice(0, 200)}...`;
  }
  
  if (content.type === 'automation_kit') {
    const kit = content.content as AutomationKitContent;
    return `${kit.title} - A complete automation workflow for ${kit.platform} that integrates ${kit.integrations.join(', ')}. ${kit.description}`;
  }
  
  if (content.type === 'bundle') {
    const bundle = content.content as BundleContent;
    return `${bundle.title} - ${bundle.description} Includes ${bundle.items.length} items with a total value of ${bundle.totalValue}.`;
  }
  
  return 'A premium digital product with professional quality content.';
}

// ============================================================================
// FIRESTORE INTEGRATION
// ============================================================================

/**
 * Update product in Firestore with generated content
 */
export async function updateProductWithContent(
  productId: string,
  content: GeneratedContent,
  collection: string = 'products'
): Promise<void> {
  const db = getFirestore();
  
  await db.collection(collection).doc(productId).update({
    hasContent: true,
    content: content.content,
    contentMarkdown: content.markdown,
    contentType: content.type,
    contentGeneratedAt: content.generatedAt,
    updatedAt: FieldValue.serverTimestamp(),
  });
  
  console.log(`[ProductVerifier] Updated Firestore product ${productId} with content`);
}

/**
 * Verify all products in a Firestore collection
 */
export async function verifyFirestoreProducts(
  collection: string = 'products',
  autoFix: boolean = false
): Promise<{
  total: number;
  valid: number;
  invalid: number;
  fixed: number;
  results: Array<{ productId: string; status: string; issues: string[] }>;
}> {
  const db = getFirestore();
  const snapshot = await db.collection(collection).get();
  
  const results: Array<{ productId: string; status: string; issues: string[] }> = [];
  let valid = 0;
  let invalid = 0;
  let fixed = 0;
  
  for (const doc of snapshot.docs) {
    const product = { id: doc.id, ...doc.data() } as ProductData;
    
    if (autoFix) {
      const { result, fixed: wasFixed, content } = await verifyAndFix(product);
      
      if (wasFixed && content) {
        await updateProductWithContent(doc.id, content, collection);
        fixed++;
      }
      
      results.push({
        productId: doc.id,
        status: result.isValid ? 'valid' : (wasFixed ? 'fixed' : 'invalid'),
        issues: result.issues,
      });
      
      if (result.isValid || wasFixed) {
        valid++;
      } else {
        invalid++;
      }
    } else {
      const result = await verifyProduct(product);
      
      results.push({
        productId: doc.id,
        status: result.isValid ? 'valid' : 'invalid',
        issues: result.issues,
      });
      
      if (result.isValid) {
        valid++;
      } else {
        invalid++;
      }
    }
  }
  
  return {
    total: snapshot.docs.length,
    valid,
    invalid,
    fixed,
    results,
  };
}


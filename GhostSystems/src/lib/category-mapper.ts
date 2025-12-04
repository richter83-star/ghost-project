/**
 * Category Mapper
 * 
 * Maps product types to Shopify-friendly categories for consistent categorization
 */

/**
 * Infer product category from title
 * @param title - Product title
 * @param productType - Existing product type (if any)
 * @returns Shopify-friendly category string
 */
export function inferCategory(title: string, productType?: string): string {
  if (!title) return 'Digital Goods';
  
  const lowerTitle = title.toLowerCase();
  const lowerType = (productType || '').toLowerCase();
  
  // Direct type mapping (highest priority)
  if (lowerType.includes('prompt_pack') || lowerType.includes('prompt pack') || lowerType.includes('prompt')) {
    return 'Digital Artwork';
  }
  if (lowerType.includes('automation_kit') || lowerType.includes('automation kit') || lowerType.includes('automation')) {
    return 'Digital Services';
  }
  if (lowerType.includes('bundle')) {
    return 'Digital Bundle';
  }
  
  // Title-based inference
  // Prompt packs
  if (
    lowerTitle.includes('prompt pack') ||
    lowerTitle.includes('prompt pack') ||
    lowerTitle.includes('prompts') ||
    lowerTitle.includes('prompt') ||
    lowerTitle.includes('midjourney') ||
    lowerTitle.includes('dall·e') ||
    lowerTitle.includes('dalle') ||
    lowerTitle.includes('sdxl') ||
    lowerTitle.includes('illustration') ||
    lowerTitle.includes('aesthetic') ||
    lowerTitle.includes('covers') ||
    lowerTitle.includes('photography')
  ) {
    return 'Digital Artwork';
  }
  
  // Automation kits
  if (
    lowerTitle.includes('automation') ||
    lowerTitle.includes('workflow') ||
    lowerTitle.includes('zapier') ||
    lowerTitle.includes('n8n') ||
    lowerTitle.includes('make.com') ||
    lowerTitle.includes('kit') ||
    lowerTitle.includes('crm') ||
    lowerTitle.includes('integration') ||
    lowerTitle.includes('onboarding')
  ) {
    return 'Digital Services';
  }
  
  // Bundles
  if (
    lowerTitle.includes('bundle') ||
    lowerTitle.includes('high-ticket') ||
    lowerTitle.includes('premium pairing') ||
    (lowerTitle.includes('+') && (lowerTitle.includes('automation') || lowerTitle.includes('prompt')))
  ) {
    return 'Digital Bundle';
  }
  
  // Default fallback
  return 'Digital Goods';
}

/**
 * Map product type to Shopify category
 * @param productType - Product type (e.g., 'prompt_pack', 'automation_kit', 'bundle')
 * @returns Shopify-friendly category string
 */
export function mapProductTypeToCategory(productType: string): string {
  const typeMap: Record<string, string> = {
    'prompt_pack': 'Digital Artwork',
    'automation_kit': 'Digital Services',
    'bundle': 'Digital Bundle',
  };
  
  const normalized = productType.toLowerCase().trim();
  return typeMap[normalized] || 'Digital Goods';
}

/**
 * Get the best category for a product
 * Combines type mapping and title inference
 */
export function getBestCategory(title: string, productType?: string): string {
  // If we have a product type, use direct mapping first
  if (productType) {
    const mapped = mapProductTypeToCategory(productType);
    // If mapping found something specific (not default), use it
    if (mapped !== 'Digital Goods') {
      return mapped;
    }
  }
  
  // Fall back to title inference
  return inferCategory(title, productType);
}


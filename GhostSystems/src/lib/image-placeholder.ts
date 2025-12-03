/**
 * Image Placeholder Service
 * 
 * Provides placeholder images for products when real images aren't available.
 * Uses Unsplash Source API for beautiful, relevant placeholder images.
 */

/**
 * Generate a placeholder image URL using Unsplash Source API
 * @param title - Product title (used to generate relevant image)
 * @param productType - Product type (for better image selection)
 * @returns Placeholder image URL
 */
export function getPlaceholderImageUrl(title: string, productType: string): string {
  // Extract keywords from title for better image relevance
  const keywords = extractKeywords(title, productType);
  
  // Use Unsplash Source API (free, no API key needed)
  // Format: https://source.unsplash.com/{width}x{height}/?{keywords}
  const width = 800;
  const height = 800;
  
  // Build keyword string
  const keywordString = keywords.join(',');
  
  // Use Unsplash Source with keywords
  return `https://source.unsplash.com/${width}x${height}/?${keywordString}&sig=${hashString(title)}`;
}

/**
 * Extract relevant keywords from title and product type
 */
function extractKeywords(title: string, productType: string): string[] {
  const keywords: string[] = [];
  
  // Add product type keywords
  if (productType.includes('prompt')) {
    keywords.push('digital', 'technology', 'creative');
  }
  if (productType.includes('automation')) {
    keywords.push('automation', 'workflow', 'productivity');
  }
  if (productType.includes('bundle')) {
    keywords.push('package', 'collection', 'set');
  }
  
  // Extract key words from title (3-5 letter words, meaningful)
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(word => {
      // Filter out common words
      const common = ['pack', 'prompts', 'prompt', 'kit', 'automation', 'bundle', 'high', 'ticket', 'the', 'a', 'an', 'and', 'or', 'for', 'with', 'of'];
      return word.length >= 4 && !common.includes(word) && /^[a-z]+$/.test(word);
    })
    .slice(0, 3); // Take first 3 meaningful words
  
  keywords.push(...words);
  
  // Fallback keywords if nothing extracted
  if (keywords.length === 0) {
    keywords.push('digital', 'product', 'creative');
  }
  
  return keywords;
}

/**
 * Hash string to create consistent image selection
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % 1000;
}

/**
 * Alternative: Use placeholder.com service (more reliable, but generic)
 */
export function getGenericPlaceholderUrl(title: string, productType: string): string {
  // Use a simple, professional placeholder
  // You can replace this with your own placeholder service or CDN
  const width = 800;
  const height = 800;
  const text = encodeURIComponent(title.substring(0, 30));
  
  // Using placeholder.com style service
  return `https://via.placeholder.com/${width}x${height}/1a1a1a/ffffff?text=${text}`;
}

/**
 * Get best available placeholder image URL
 * Uses reliable, publicly accessible image URLs that Shopify can fetch
 */
export function getBestPlaceholderImage(title?: string, productType?: string): string {
  const width = 800;
  const height = 800;
  
  // Use a seed based on title to get consistent images per product
  const seed = title ? hashString(title) : Math.floor(Math.random() * 1000);
  
  // Use placeholder.com - reliable, fast, and Shopify-friendly
  // This service is specifically designed for placeholder images
  const colors = [
    '6366f1', // Indigo
    '8b5cf6', // Purple  
    'ec4899', // Pink
    'f59e0b', // Amber
    '10b981', // Emerald
    '3b82f6', // Blue
    'ef4444', // Red
    '14b8a6', // Teal
  ];
  
  const color = colors[seed % colors.length];
  const text = encodeURIComponent('Digital Product');
  
  // placeholder.com is very reliable for Shopify
  return `https://via.placeholder.com/${width}x${height}/${color}/ffffff?text=${text}`;
}


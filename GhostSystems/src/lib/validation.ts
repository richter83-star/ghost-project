/**
 * Validation utilities for product data
 */

const MIN_DESCRIPTION_LENGTH = 150; // Minimum 150 characters for a usable description

/**
 * Validates product job data
 * @param data - Product data from Firestore
 * @returns Validated and cleaned data
 * @throws Error if validation fails
 */
export function validateJobData(data: any): {
  title: string;
  description: string;
  productType: string;
  price: number;
  imageUrl?: string;
} {
  if (!data.title || typeof data.title !== 'string' || data.title.trim() === '') {
    throw new Error('Validation Failed: Missing or empty product title.');
  }

  // Accept both 'productType' and 'product_type' field names (for compatibility)
  const productType = data.productType || data.product_type;
  if (!productType || typeof productType !== 'string' || productType.trim() === '') {
    throw new Error('Validation Failed: Missing or empty product type.');
  }

  // Accept both 'price' and 'price_usd' field names (for compatibility)
  const price = data.price || data.price_usd;
  if (!price || isNaN(price) || Number(price) <= 0) {
    throw new Error('Validation Failed: Missing, invalid, or zero price.');
  }

  // Description is optional (can be generated)
  const description = data.description
    ? String(data.description).trim()
    : '';

  // Image URL is optional (can be generated)
  const imageUrl = data.imageUrl
    ? String(data.imageUrl).trim()
    : undefined;

  return {
    title: data.title.trim(),
    description,
    productType: productType.trim(),
    price: Number(price),
    ...(imageUrl && { imageUrl }),
  };
}

/**
 * Check if description is missing or too short
 * @param description - Description to check
 * @returns True if description needs generation
 */
export function isDescriptionMissing(description?: string): boolean {
  if (!description || typeof description !== 'string') {
    return true;
  }
  return description.trim().length < MIN_DESCRIPTION_LENGTH;
}


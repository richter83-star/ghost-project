/**
 * Validation utilities for product data
 */

const MIN_DESCRIPTION_LENGTH = 20;

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

  if (!data.productType || typeof data.productType !== 'string' || data.productType.trim() === '') {
    throw new Error('Validation Failed: Missing or empty product type.');
  }

  if (!data.price || isNaN(data.price) || Number(data.price) <= 0) {
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
    productType: data.productType.trim(),
    price: Number(data.price),
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


import { config } from '../config.js';

/**
 * Validates the core data of a product job.
 * Throws an error if validation fails.
 * @param {object} data - The job data from Firestore.
 * @returns {object} - The same data, if valid.
 */
export function validateJobData(data) {
  if (!data.title || data.title.trim() === '') {
    throw new Error('Validation Failed: Missing or empty product title.');
  }
// ... existing code ...
  if (!data.price || isNaN(data.price) || Number(data.price) <= 0) {
    throw new Error('Validation Failed: Missing, invalid, or zero price.');
  }
  // REMOVED: imageUrl validation. The pipeline will generate the image.

  // Return a cleaned-up version
  return {
// ... existing code ...
    productType: data.productType.trim(),
    price: Number(data.price),
  };
}

/**
// ... existing code ...
 * @returns {boolean} - True if description is missing/short, false otherwise.
 */
export function isDescriptionMissing(description) {
// ... existing code ...
  const minLength = config.validation.minDescriptionLength;
  return !description || description.trim().length < minLength;
}

// REMOVED: The isValidHttpUrl function is no longer needed.

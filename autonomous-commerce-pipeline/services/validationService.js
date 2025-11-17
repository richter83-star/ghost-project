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
  if (!data.productType || data.productType.trim() === '') {
    throw new Error('Validation Failed: Missing or empty productType.');
  }
  if (!data.price || isNaN(data.price) || Number(data.price) <= 0) {
    throw new Error('Validation Failed: Missing, invalid, or zero price.');
  }
  if (!data.imageUrl || !isValidHttpUrl(data.imageUrl)) {
    throw new Error('Validation Failed: Missing or invalid imageUrl.');
  }

  // Return a cleaned-up version
  return {
    ...data,
    title: data.title.trim(),
    productType: data.productType.trim(),
    price: Number(data.price),
  };
}

/**
 * Checks if a product description is missing or too short.
 * @param {string} description - The product description.
 * @returns {boolean} - True if description is missing/short, false otherwise.
 */
export function isDescriptionMissing(description) {
  const minLength = config.validation.minDescriptionLength;
  return !description || description.trim().length < minLength;
}

/**
 * Simple URL validator.
 * @param {string} string - The URL string to test.
 * @returns {boolean}
 */
function isValidHttpUrl(string) {
  let url;
  try {
    url = new URL(string);
  } catch (_) {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}
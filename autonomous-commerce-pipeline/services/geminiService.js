import { config } from '../config.js';
import { fetchWithRetry } from '../utils/apiHelper.js';

const { apiKey, model, descriptionPrompt } = config.gemini;
// ... existing code ...
 * @returns {Promise<string>} - The generated description text.
 */
export async function generateDescription(jobData) {
  const { title, productType } = jobData; // Removed imageUrl

  // Construct the user prompt
  const userQuery = `
    Product Title: "${title}"
    Product Type: "${productType}"
  `; // Removed Image URL

  const payload = {
// ... existing code ...
  } catch (error) {
    console.error(`Gemini API call failed: ${error.message}`);
    throw new Error(`Failed to generate description: ${error.message}`);
  }
}

/**
 * Generates a product image using the Imagen 4 model.
 * @param {string} prompt - The prompt for image generation.
 * @returns {Promise<string>} - The base64 encoded image data.
 */
export async function generateImage(prompt) {
  // Use the imagen-4.0-generate-001 model for image generation
  const apiUrl = `https://generativelace.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;

  const payload = {
    instances: {
      prompt: `A stunning, high-resolution 8k, commercial product photo, on a clean studio background, of: ${prompt}`
    },
    parameters: {
      "sampleCount": 1
    }
  };

  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  };

  try {
    const result = await fetchWithRetry(apiUrl, options);
    const base64ImageData = result.predictions?.[0]?.bytesBase64Encoded;

    if (!base64ImageData) {
      throw new Error('Imagen API returned an invalid response structure.');
    }
    
    return base64ImageData;

  } catch (error) {
    console.error(`Imagen API call failed: ${error.message}`);
    throw new Error(`Failed to generate image: ${error.message}`);
  }
}

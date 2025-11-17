import { config } from '../config.js';
import { fetchWithRetry } from '../utils/apiHelper.js';

const { apiKey, model, descriptionPrompt } = config.gemini;
const apiUrl = `https://generativelace.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

/**
 * Generates a product description using the Gemini API.
 * @param {object} jobData - The product job data.
 * @returns {Promise<string>} - The generated description text.
 */
export async function generateDescription(jobData) {
  const { title, productType, imageUrl } = jobData;

  // Construct the user prompt
  const userQuery = `
    Product Title: "${title}"
    Product Type: "${productType}"
    Image URL: ${imageUrl}
  `;

  const payload = {
    contents: [{ parts: [{ text: userQuery }] }],
    systemInstruction: {
      parts: [{ text: descriptionPrompt }],
    },
  };

  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };

  try {
    const result = await fetchWithRetry(apiUrl, options, 3, 2000);

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('Gemini API returned an invalid response structure.');
    }
    
    // Clean the text (remove quotes, etc.)
    return text.replace(/["']/g, '').trim();

  } catch (error) {
    console.error(`Gemini API call failed: ${error.message}`);
    throw new Error(`Failed to generate description: ${error.message}`);
  }
}
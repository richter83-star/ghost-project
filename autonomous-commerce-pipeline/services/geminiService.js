import { config } from '../config.js';
import { fetchWithRetry } from '../utils/apiHelper.js';

const { apiKey, model, descriptionPrompt } = config.gemini;
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

export async function generateDescription(jobData) {
  const { title, productType } = jobData;

  const userQuery = `
    Product Title: "${title}"
    Product Type: "${productType}"
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
    
    return text.replace(/["']/g, '').trim();

  } catch (error) {
    console.error(`Gemini API call failed: ${error.message}`);
    throw new Error(`Failed to generate description: ${error.message}`);
  }
}

export async function generateImage(prompt) {
  // Use Imagen 4 (Nano Banana) for image generation - requires billing, falls back gracefully
  const imageApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict?key=${apiKey}`;

  const payload = {
    instances: [
      {
        prompt: `A stunning, high-resolution 8k, commercial product photo, on a clean studio background, of: ${prompt}`
      }
    ],
    parameters: {
      sampleCount: 1
    }
  };

  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  };

  try {
    const result = await fetchWithRetry(imageApiUrl, options);
    
    const base64ImageData = result.predictions?.[0]?.bytesBase64Encoded;

    if (!base64ImageData) {
      console.error("Imagen API Response:", JSON.stringify(result, null, 2));
      throw new Error('Imagen API returned an invalid response structure.');
    }
    
    return base64ImageData;

  } catch (error) {
    console.error(`Imagen API call failed: ${error.message}`);
    throw new Error(`Failed to generate image: ${error.message}`);
  }
}
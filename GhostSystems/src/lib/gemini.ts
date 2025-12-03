import axios from 'axios';

/**
 * Gemini AI Service
 * Handles content generation for products (descriptions and images)
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-09-2025';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const DESCRIPTION_PROMPT = `
  You are an expert e-commerce copywriter.
  Your task is to write a compelling, SEO-friendly, and persuasive product description.
  Use the provided title, product type, and image URL analysis to create a description.
  The output MUST be plain text, with no Markdown or HTML.
  Keep it concise, between 2 and 4 sentences.
`;

/**
 * Generate product description using Gemini
 * @param title - Product title
 * @param productType - Product type/category
 * @returns Promise<string> - Generated description
 */
export async function generateDescription(
  title: string,
  productType: string
): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const userQuery = `
    Product Title: "${title}"
    Product Type: "${productType}"
  `;

  const payload = {
    contents: [{ parts: [{ text: userQuery }] }],
    systemInstruction: {
      parts: [{ text: DESCRIPTION_PROMPT }],
    },
  };

  try {
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      payload,
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );

    const text =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error('Gemini API returned an invalid response structure.');
    }

    // Clean up the response - remove quotes and trim
    return text.replace(/["']/g, '').trim();
  } catch (error: any) {
    console.error('[Gemini] Failed to generate description:', error.message);
    throw new Error(`Failed to generate description: ${error.message}`);
  }
}

/**
 * Generate product image using Imagen (via Gemini API)
 * @param prompt - Image generation prompt
 * @returns Promise<string> - Base64 encoded image data
 */
export async function generateImage(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  const imageApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${GEMINI_API_KEY}`;

  const payload = {
    instances: [
      {
        prompt: `A stunning, high-resolution 8k, commercial product photo, on a clean studio background, of: ${prompt}`,
      },
    ],
    parameters: {
      sampleCount: 1,
    },
  };

  try {
    const response = await axios.post(imageApiUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    const base64ImageData =
      response.data?.predictions?.[0]?.bytesBase64Encoded;

    if (!base64ImageData) {
      console.error(
        '[Gemini] Imagen API Response:',
        JSON.stringify(response.data, null, 2)
      );
      throw new Error(
        'Imagen API returned an invalid response structure.'
      );
    }

    return base64ImageData;
  } catch (error: any) {
    console.error('[Gemini] Failed to generate image:', error.message);
    throw new Error(`Failed to generate image: ${error.message}`);
  }
}

/**
 * Validate Gemini configuration
 */
export function validateConfig(): boolean {
  if (!GEMINI_API_KEY) {
    console.warn(
      '[Gemini] GEMINI_API_KEY not set. Content generation will be disabled.'
    );
    return false;
  }
  return true;
}


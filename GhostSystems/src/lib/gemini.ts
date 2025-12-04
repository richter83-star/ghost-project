import axios from 'axios';

/**
 * Gemini AI Service
 * Handles content generation for products (descriptions and images)
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-preview-09-2025';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const DESCRIPTION_PROMPT = `
  You are an expert e-commerce copywriter specializing in digital products.
  
  Write a compelling, SEO-friendly product description that:
  - Is 4-6 sentences long (minimum 150 words)
  - Highlights key features and benefits
  - Uses persuasive, professional language
  - Includes relevant keywords naturally
  - Explains what the customer will receive
  - Creates urgency and value perception
  
  The output MUST be plain text only, with no Markdown or HTML formatting.
  Write in a clear, professional tone that sells the product effectively.
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
    Write a compelling product description for:
    
    Product Title: "${title}"
    Product Type: "${productType}"
    
    Make it detailed, persuasive, and highlight the value this product provides to customers.
    Focus on benefits, not just features. Write as if you're speaking directly to the ideal customer.
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
 * Generate product-type-specific image prompts
 */
function getImagePromptForProductType(title: string, productType: string): string {
  const basePrompt = `Professional digital product cover art, clean modern design, high contrast, no text or watermarks`;
  
  const typePrompts: Record<string, string> = {
    'prompt_pack': `${basePrompt}, neon cyberpunk aesthetic, dark background with glowing accents, futuristic digital artwork style, abstract geometric patterns, representing "${title}"`,
    'automation_kit': `${basePrompt}, tech workflow diagram aesthetic, clean professional design, blue and white color scheme, interconnected nodes and lines, circuit board inspired, representing "${title}"`,
    'bundle': `${basePrompt}, premium package mockup, luxury aesthetic, dark elegant background, gold accents, multiple product showcase, high-end digital bundle, representing "${title}"`,
    'Digital Artwork': `${basePrompt}, artistic digital illustration, vibrant colors, creative design, abstract elements, representing "${title}"`,
    'Digital Services': `${basePrompt}, professional service visualization, clean business aesthetic, blue tones, modern minimalist, representing "${title}"`,
    'Digital Bundle': `${basePrompt}, premium bundle display, multiple items showcase, elegant presentation, dark background with highlights, representing "${title}"`,
  };
  
  // Find matching prompt or use default
  const matchedType = Object.keys(typePrompts).find(
    key => productType.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(productType.toLowerCase())
  );
  
  if (matchedType) {
    return typePrompts[matchedType];
  }
  
  // Default prompt for unknown types
  return `${basePrompt}, sleek digital product visualization, modern tech aesthetic, gradient background, representing "${title}"`;
}

/**
 * Generate product image using Gemini 2.0 Flash (experimental image generation)
 * @param title - Product title
 * @param productType - Product type for specialized prompts
 * @returns Promise<string> - Base64 encoded image data
 */
export async function generateImage(title: string, productType: string = 'digital'): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  // Use Gemini 2.0 Flash experimental for image generation
  const imageApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`;
  
  // Get product-type-specific prompt
  const imagePrompt = getImagePromptForProductType(title, productType);
  console.log(`[Gemini] Generating image with prompt: ${imagePrompt.substring(0, 100)}...`);

  const payload = {
    contents: [
      {
        parts: [
          {
            text: `Generate an image: ${imagePrompt}`
          }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      responseMimeType: 'image/png'
    }
  };

  try {
    const response = await axios.post(imageApiUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 90000, // 90 second timeout for image generation
    });

    // Try to extract image from response
    const candidates = response.data?.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('No candidates in response');
    }

    const parts = candidates[0]?.content?.parts;
    if (!parts || parts.length === 0) {
      throw new Error('No parts in response');
    }

    // Look for inline_data (base64 image)
    for (const part of parts) {
      if (part.inlineData?.data) {
        console.log(`[Gemini] ✅ Image generated successfully (${Math.round(part.inlineData.data.length / 1024)}KB)`);
        return part.inlineData.data;
      }
    }

    // If no image found, log the response for debugging
    console.error('[Gemini] Response structure:', JSON.stringify(response.data, null, 2).substring(0, 1000));
    throw new Error('No image data found in response');
  } catch (error: any) {
    const errorDetails = error.response?.data || error.message;
    console.error('[Gemini] Failed to generate image:', JSON.stringify(errorDetails).substring(0, 500));
    throw new Error(`Failed to generate image: ${error.message}`);
  }
}

/**
 * Generate product image with fallback to placeholder
 * @param title - Product title
 * @param productType - Product type
 * @returns Promise<{ base64?: string; url?: string }> - Either base64 data or fallback URL
 */
export async function generateProductImage(
  title: string,
  productType: string
): Promise<{ base64?: string; url?: string; source: 'ai' | 'placeholder' }> {
  // Check if Imagen is enabled
  const enableImagen = process.env.ENABLE_AI_IMAGES !== 'false';
  
  if (!enableImagen || !GEMINI_API_KEY) {
    console.log('[Gemini] AI image generation disabled or no API key, using placeholder');
    return { source: 'placeholder' };
  }
  
  try {
    const base64 = await generateImage(title, productType);
    return { base64, source: 'ai' };
  } catch (error: any) {
    console.warn(`[Gemini] Image generation failed, falling back to placeholder: ${error.message}`);
    return { source: 'placeholder' };
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


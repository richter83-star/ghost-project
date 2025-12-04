import axios from 'axios';

/**
 * Gemini AI Service
 * Handles content generation for products (descriptions and images)
 * Supports Nano Banana (Imagen 4) for enhanced image generation
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.0-flash';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Image generation model - defaults to Gemini Flash (free) or Nano Banana if billing enabled
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.0-flash-exp';
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

// Fallback image models in order of preference
const IMAGE_MODEL_FALLBACKS = [
  'gemini-2.0-flash-exp',                // Gemini Flash (free tier, native image gen)
  'imagen-4.0-generate-001',             // Nano Banana (requires billing)
  'imagen-4.0-fast-generate-001',        // Nano Banana Fast (requires billing)
];

// Cache for available models
let cachedImageModels: string[] | null = null;

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
 * Generate product image using Gemini Flash or Nano Banana (Imagen 4)
 * @param title - Product title
 * @param productType - Product type for specialized prompts
 * @returns Promise<string> - Base64 encoded image data
 */
export async function generateImage(title: string, productType: string = 'digital'): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  // Get product-type-specific prompt
  const imagePrompt = getImagePromptForProductType(title, productType);
  console.log(`[Gemini] Generating image with prompt: ${imagePrompt.substring(0, 100)}...`);

  const model = await getBestImageModel();
  const isImagen = model.includes('imagen');

  try {
    if (isImagen) {
      console.log('[Gemini] Using Nano Banana (Imagen 4)...');
      return await generateImageWithImagen(imagePrompt);
    } else {
      console.log('[Gemini] Using Gemini Flash image generation...');
      return await generateImageWithGemini(imagePrompt);
    }
  } catch (error: any) {
    const errorDetails = error.response?.data || error.message;
    console.error('[Gemini] Image generation failed:', JSON.stringify(errorDetails).substring(0, 500));
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

/**
 * List all available models from Google AI
 * @returns Promise<Array> - List of available models
 */
export async function listAvailableModels(): Promise<Array<{ name: string; displayName: string; supportedGenerationMethods: string[] }>> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  try {
    const response = await axios.get(
      `${GEMINI_BASE_URL}/models?key=${GEMINI_API_KEY}`,
      { headers: { 'Content-Type': 'application/json' } }
    );

    return response.data?.models || [];
  } catch (error: any) {
    console.error('[Gemini] Failed to list models:', error.message);
    throw new Error(`Failed to list models: ${error.message}`);
  }
}

/**
 * Get available image generation models
 * @returns Promise<string[]> - List of model names that support image generation
 */
export async function getAvailableImageModels(): Promise<string[]> {
  if (cachedImageModels) {
    return cachedImageModels;
  }

  try {
    const models = await listAvailableModels();
    
    // Filter for image generation capable models
    const imageModels = models
      .filter(m => 
        m.name.includes('imagen') || 
        m.supportedGenerationMethods?.includes('generateImage') ||
        m.name.includes('image')
      )
      .map(m => m.name.replace('models/', ''));
    
    cachedImageModels = imageModels;
    console.log('[Gemini] Available image models:', imageModels);
    return imageModels;
  } catch (error: any) {
    console.warn('[Gemini] Could not fetch available models, using defaults');
    return IMAGE_MODEL_FALLBACKS;
  }
}

/**
 * Find the best available image model
 * Prefers Nano Banana (Imagen 4) if available
 */
async function getBestImageModel(): Promise<string> {
  // If user explicitly set a model, use it
  if (process.env.GEMINI_IMAGE_MODEL) {
    return process.env.GEMINI_IMAGE_MODEL;
  }

  try {
    const available = await getAvailableImageModels();
    
    // Check our preferred models in order
    for (const preferred of IMAGE_MODEL_FALLBACKS) {
      if (available.some(m => m.includes(preferred) || preferred.includes(m))) {
        console.log(`[Gemini] Selected image model: ${preferred}`);
        return preferred;
      }
    }
    
    // If none of our preferred models found, use first available imagen model
    const imagenModel = available.find(m => m.includes('imagen'));
    if (imagenModel) {
      console.log(`[Gemini] Using available imagen model: ${imagenModel}`);
      return imagenModel;
    }
  } catch (error) {
    console.warn('[Gemini] Model detection failed, using default');
  }

  return IMAGE_MODEL_FALLBACKS[IMAGE_MODEL_FALLBACKS.length - 1]; // Fallback to Gemini Flash
}

/**
 * Generate image using Imagen API (Nano Banana / Imagen 4)
 * @param prompt - Image generation prompt
 * @returns Promise<string> - Base64 encoded image data
 */
async function generateImageWithImagen(prompt: string): Promise<string> {
  const model = await getBestImageModel();
  const apiUrl = `${GEMINI_BASE_URL}/models/${model}:predict?key=${GEMINI_API_KEY}`;

  console.log(`[Gemini] Using Imagen model: ${model}`);

  const payload = {
    instances: [{ prompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: '1:1',
      outputOptions: {
        mimeType: 'image/png'
      }
    }
  };

  const response = await axios.post(apiUrl, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 120000, // 2 min timeout for high-quality generation
  });

  const predictions = response.data?.predictions;
  if (!predictions || predictions.length === 0) {
    throw new Error('No predictions in Imagen response');
  }

  const imageData = predictions[0]?.bytesBase64Encoded;
  if (!imageData) {
    throw new Error('No image data in Imagen response');
  }

  console.log(`[Gemini] ✅ Imagen generated image (${Math.round(imageData.length / 1024)}KB)`);
  return imageData;
}

/**
 * Generate image using Gemini multimodal
 * @param prompt - Image generation prompt
 * @returns Promise<string> - Base64 encoded image data
 */
async function generateImageWithGemini(prompt: string): Promise<string> {
  const model = await getBestImageModel();
  const apiUrl = `${GEMINI_BASE_URL}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  console.log(`[Gemini] Using model: ${model}`);

  const payload = {
    contents: [{ parts: [{ text: `Generate an image: ${prompt}` }] }],
    generationConfig: {
      responseModalities: ['Text', 'Image'],  // Correct casing for Gemini API
    }
  };

  const response = await axios.post(apiUrl, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 120000, // 2 min timeout for image generation
  });

  const parts = response.data?.candidates?.[0]?.content?.parts;
  if (!parts) {
    throw new Error('No parts in Gemini response');
  }

  for (const part of parts) {
    if (part.inlineData?.data) {
      console.log(`[Gemini] ✅ Generated image (${Math.round(part.inlineData.data.length / 1024)}KB)`);
      return part.inlineData.data;
    }
  }

  throw new Error('No image data in Gemini response');
}

/**
 * Print available models summary (for debugging/setup)
 */
export async function printModelsSummary(): Promise<void> {
  console.log('\n🔍 Scanning available Google AI models...\n');
  
  try {
    const models = await listAvailableModels();
    
    console.log('📋 All Available Models:');
    console.log('─'.repeat(60));
    
    const grouped: Record<string, typeof models> = {};
    for (const model of models) {
      const category = model.name.includes('imagen') ? 'Image Generation' :
                       model.name.includes('gemini') ? 'Gemini' :
                       model.name.includes('embedding') ? 'Embeddings' : 'Other';
      if (!grouped[category]) grouped[category] = [];
      grouped[category].push(model);
    }
    
    for (const [category, categoryModels] of Object.entries(grouped)) {
      console.log(`\n🏷️  ${category}:`);
      for (const m of categoryModels) {
        const name = m.name.replace('models/', '');
        const methods = m.supportedGenerationMethods?.join(', ') || 'N/A';
        console.log(`   • ${name}`);
        console.log(`     Methods: ${methods}`);
      }
    }
    
    console.log('\n' + '─'.repeat(60));
    console.log('💡 Set GEMINI_IMAGE_MODEL env var to use a specific model');
    console.log('   Example: GEMINI_IMAGE_MODEL=imagen-4.0-generate-preview-05-20\n');
  } catch (error: any) {
    console.error('❌ Failed to fetch models:', error.message);
  }
}


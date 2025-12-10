import 'dotenv/config';

function getEnv(key, defaultValue) {
  const value = process.env[key];
  if (value === undefined || value === null || value === '') {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`[GhostSystems][Config] Missing required environment variable: ${key}`);
  }
  return value;
}

const config = {
  firebase: {
    serviceAccountJson: getEnv('FIREBASE_SERVICE_ACCOUNT_JSON'),
    jobsCollection: process.env.FIRESTORE_JOBS_COLLECTION || 'products',
  },
  gemini: {
    apiKey: getEnv('GEMINI_API_KEY'),
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    imageModel: process.env.GEMINI_IMAGE_MODEL || 'imagen-3.0-generate-001',
    descriptionPrompt: `You are an e-commerce copywriter for digital products. Using the provided title, product type, and any existing short description, write a concise 2–4 sentence description that drives conversions. Keep the tone clear and value-focused, highlight what the customer receives, and make sure the copy is safe for HTML embedding (use simple <p> tags only, no other markup). Avoid exaggeration and keep it truthful to the product type.`,
  },
  shopify: {
    storeUrl: getEnv('SHOPIFY_STORE_URL'),
    adminToken: getEnv('SHOPIFY_ADMIN_API_TOKEN'),
    apiVersion: process.env.SHOPIFY_API_VERSION || '2024-10',
  },
  validation: {
    minDescriptionLength: Number(process.env.MIN_DESCRIPTION_LENGTH || 20),
  },
};

export { getEnv, config };
export default config;

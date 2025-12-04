import dotenv from 'dotenv';
dotenv.config();

// Helper to check for required env vars
const getEnv = (key) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

export const config = {
  firebase: {
    serviceAccountPath: getEnv('FIREBASE_SERVICE_ACCOUNT_PATH'),
    jobsCollection: process.env.FIRESTORE_JOBS_COLLECTION || 'products',
  },
  shopify: {
    storeUrl: getEnv('SHOPIFY_STORE_URL'),
    adminToken: getEnv('SHOPIFY_ADMIN_API_TOKEN'),
    apiVersion: getEnv('SHOPIFY_API_VERSION'),
  },
  gemini: {
    // API key is left as an empty string.
    // The runtime environment will provide it.
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-3.0-flash',
    // System prompt to guide the LLM
    descriptionPrompt: `
      You are an expert e-commerce copywriter.
      Your task is to write a compelling, SEO-friendly, and persuasive product description.
      Use the provided title, product type, and image URL analysis to create a description.
      The output MUST be plain text, with no Markdown or HTML.
      Keep it concise, between 2 and 4 sentences.
    `,
  },
  validation: {
    // Require descriptions to be at least this long
    minDescriptionLength: 20,
  },
};
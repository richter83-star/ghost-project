import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { validateJobData, isDescriptionMissing } from '../lib/validation.js';
import { generateDescription, generateProductImage } from '../lib/gemini.js';
import { createProduct, validateConfig as validateShopifyConfig } from '../lib/shopify.js';
import { getBestPlaceholderImage } from '../lib/image-placeholder.js';
import { verifyAndFix, updateProductWithContent, GeneratedContent } from '../lib/product-verifier.js';
import { generateProductContent } from '../lib/content-generator.js';

let db: FirebaseFirestore.Firestore | null = null;

// Rate limiting configuration
// Shopify REST Admin API allows ~2 requests/second (or 40 requests/minute)
// Process one product every 2 seconds to stay well within limits
const PROCESSING_DELAY_MS = parseInt(
  process.env.SHOPIFY_PIPELINE_DELAY_MS || '2000',
  10
); // Default: 2 seconds between products
// Processing queue and state
const processingQueue: Array<FirebaseFirestore.QueryDocumentSnapshot> = [];
let isProcessing = false;

/**
 * Initialize Firebase Admin for Shopify pipeline
 */
function initFirebase() {
  if (db) return;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson) {
    console.error(
      '[ShopifyPipeline] ❌ FIREBASE_SERVICE_ACCOUNT_JSON missing. Pipeline will NOT run.'
    );
    return;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);

    if (!getApps().length) {
      initializeApp({
        credential: cert(serviceAccount as any),
      });
    }

    db = getFirestore();
    console.log('[ShopifyPipeline] ✅ Firebase Admin initialized.');
  } catch (err) {
    console.error(
      '[ShopifyPipeline] ❌ Failed to initialize Firebase Admin:',
      err
    );
  }
}

/**
 * Process a single draft product: validate, generate content, publish to Shopify
 */
async function processDraftProduct(docSnap: FirebaseFirestore.QueryDocumentSnapshot) {
  const productId = docSnap.id;
  const data = docSnap.data();
  const title = (data as any)?.title || '(no title)';
  const status = (data as any)?.status;

  // QA Gate enforcement: Double-check status before processing
  if (status !== 'qa_passed') {
    console.warn(
      `[ShopifyPipeline] ⚠️ Skipping product ${productId} - status is "${status}", expected "qa_passed"`
    );
    return;
  }

  console.log(
    `[ShopifyPipeline] Processing QA-PASSED product: ${productId} - "${title}"`
  );

  try {
    // Update status to processing
    await docSnap.ref.update({
      status: 'processing',
      processingStartedAt: FieldValue.serverTimestamp(),
    });

    // Validate product data
    let validatedData;
    try {
      validatedData = validateJobData(data);
    } catch (error: any) {
      throw new Error(`Validation failed: ${error.message}`);
    }

    // Generate description if missing
    let description = validatedData.description;
    if (isDescriptionMissing(description)) {
      console.log(`[ShopifyPipeline] Generating description for product ${productId}...`);
      try {
        description = await generateDescription(
          validatedData.title,
          validatedData.productType
        );
        console.log(`[ShopifyPipeline] ✅ Generated description (${description.length} chars)`);
      } catch (error: any) {
        console.error(
          `[ShopifyPipeline] ⚠️ Failed to generate description: ${error.message}. Using fallback.`
        );
        description = `A high-quality ${validatedData.productType}. ${validatedData.title}.`;
      }
    }

    // Verify and generate product content if missing
    let productContent: any = data.content;
    let hasContent = data.hasContent || false;
    
    if (!hasContent) {
      console.log(`[ShopifyPipeline] Verifying/generating content for product ${productId}...`);
      try {
        const { result, fixed, content } = await verifyAndFix({
          id: productId,
          title: validatedData.title,
          description,
          productType: validatedData.productType,
          price: validatedData.price,
          imageUrl: validatedData.imageUrl,
          hasContent: false,
        });

        if (fixed && content) {
          productContent = content.content;
          hasContent = true;
          console.log(`[ShopifyPipeline] ✅ Generated ${content.type} content for product`);
          
          // Update description from content if better
          if (content.markdown && content.markdown.length > description.length) {
            const contentDescription = extractDescriptionFromContent(content);
            if (contentDescription.length > description.length) {
              description = contentDescription;
              console.log(`[ShopifyPipeline] ✅ Updated description from generated content`);
            }
          }
        } else if (!result.isValid) {
          console.warn(`[ShopifyPipeline] ⚠️ Product verification issues: ${result.issues.join(', ')}`);
        }
      } catch (error: any) {
        console.error(`[ShopifyPipeline] ⚠️ Content generation failed: ${error.message}`);
        // Continue without content - product will still be created
      }
    }

    // Generate image if missing - try AI first, fallback to placeholder
    let imageUrl = validatedData.imageUrl;
    let imageBase64: string | undefined = undefined;
    let imageSource: 'provided' | 'ai' | 'placeholder' = 'provided';
    
    if (!imageUrl) {
      console.log(`[ShopifyPipeline] Image not provided for product ${productId}, generating...`);
      
      // Try AI image generation first
      const imageResult = await generateProductImage(
        validatedData.title,
        validatedData.productType
      );
      
      if (imageResult.source === 'ai' && imageResult.base64) {
        // Use AI-generated image
        imageBase64 = imageResult.base64;
        imageSource = 'ai';
        console.log(`[ShopifyPipeline] ✅ Using AI-generated image (${Math.round(imageBase64.length / 1024)}KB)`);
      } else {
        // Fallback to placeholder
        imageUrl = getBestPlaceholderImage(validatedData.title, validatedData.productType);
        imageSource = 'placeholder';
        console.log(`[ShopifyPipeline] ✅ Using placeholder image: ${imageUrl}`);
      }
    } else {
      console.log(`[ShopifyPipeline] ✅ Using provided image URL`);
    }

    // Create product in Shopify
    console.log(`[ShopifyPipeline] Creating product in Shopify: ${productId}...`);
    const shopifyProductId = await createProduct({
      title: validatedData.title,
      description,
      productType: validatedData.productType,
      price: validatedData.price,
      imageUrl,
      imageBase64,
    });

    console.log(
      `[ShopifyPipeline] ✅ Successfully created Shopify product ID: ${shopifyProductId}`
    );

    // Update Firestore with success status
    await docSnap.ref.update({
      status: 'published',
      shopifyProductId,
      publishedAt: FieldValue.serverTimestamp(),
      description, // Save generated description
      imageSource, // Track how image was generated
      hasContent, // Track if content was generated
      ...(imageUrl && { imageUrl }),
      ...(imageBase64 && { hasAiImage: true }),
      ...(productContent && { content: productContent }),
    });

    console.log(
      `[ShopifyPipeline] ✅ Product ${productId} published successfully. Shopify ID: ${shopifyProductId}`
    );
  } catch (error: any) {
    console.error(
      `[ShopifyPipeline] ❌ Failed to process product ${productId}:`,
      error.message
    );

    // Update Firestore with failure status
    await docSnap.ref.update({
      status: 'failed',
      error: error.message,
      failedAt: FieldValue.serverTimestamp(),
    });
  }
}

/**
 * Process the queue with rate limiting
 * Processes products sequentially with delays to avoid overwhelming Shopify API
 */
async function processQueue() {
  if (isProcessing || processingQueue.length === 0) {
    return;
  }

  isProcessing = true;
  console.log(
    `[ShopifyPipeline] 🚀 Starting queue processing (${processingQueue.length} items in queue, delay: ${PROCESSING_DELAY_MS}ms between products)`
  );

  while (processingQueue.length > 0) {
    const docSnap = processingQueue.shift();
    if (!docSnap) break;
    const data = docSnap.data();
    const title = (data as any)?.title || '(no title)';

    console.log(
      `[ShopifyPipeline] 📦 Processing product from queue: "${title}" (${processingQueue.length} remaining)`
    );

    try {
      // Process product sequentially (await to ensure one at a time)
      await processDraftProduct(docSnap);
    } catch (error: any) {
      console.error(
        `[ShopifyPipeline] Unhandled error processing product ${docSnap.id}:`,
        error
      );
    } finally {
      // Product processing complete, continue to next
    }

    // Rate limit: wait before processing next product
    // Only wait if there are more items in queue
    if (processingQueue.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, PROCESSING_DELAY_MS));
    }
  }

  isProcessing = false;
  
  // Check if more items were added to the queue while processing
  if (processingQueue.length > 0) {
    console.log(
      `[ShopifyPipeline] 🔄 More items added to queue (${processingQueue.length} remaining), continuing processing...`
    );
    // Recursively process remaining items (await to prevent race conditions)
    await processQueue();
  } else {
    console.log('[ShopifyPipeline] ✅ Queue processing complete');
  }
}

/**
 * Start the Shopify product pipeline listener
 * Watches for products with status "qa_passed" (QA Gate enforced) and processes them
 */
export function startShopifyPipeline() {
  initFirebase();

  if (!db) {
    console.error(
      '[ShopifyPipeline] ❌ Firestore not initialized. Aborting pipeline listener.'
    );
    return;
  }

  // Validate Shopify configuration
  if (!validateShopifyConfig()) {
    console.error(
      '[ShopifyPipeline] ❌ Shopify configuration invalid. Pipeline will not create products.'
    );
    // Don't return - still listen, but won't publish
  }

  const collectionName = process.env.FIRESTORE_JOBS_COLLECTION || 'products';

  console.log(
    `[ShopifyPipeline] 📡 Listening for products with status = "qa_passed" (QA Gate enforced) in collection "${collectionName}"...`
  );

  const productsRef = db.collection(collectionName);
  // QA Gate: Only process products that have passed QA
  // Strict requirement: status MUST be "qa_passed" to be published
  const query = productsRef.where('status', '==', 'qa_passed');

  query.onSnapshot(
    (snapshot) => {
      // Count new documents synchronously before processing
      const newDrafts = snapshot.docChanges().filter(
        (change) => change.type === 'added'
      );
      const draftCount = newDrafts.length;

      // Add new drafts to processing queue
      newDrafts.forEach((change) => {
        processingQueue.push(change.doc);
      });

      // Log if there are new drafts to process
      if (draftCount > 0) {
        console.log(
          `[ShopifyPipeline] ✅ Queued ${draftCount} draft product(s) for processing (queue size: ${processingQueue.length})`
        );
      }

      // Start processing queue if not already running
      if (!isProcessing && processingQueue.length > 0) {
        processQueue();
      }
    },
    (error) => {
      console.error('[ShopifyPipeline] ❌ Listener Error:', error);
    }
  );

  console.log('[ShopifyPipeline] 👻 Pipeline listener is active.');
}

/**
 * Extract a description from generated content
 */
function extractDescriptionFromContent(content: any): string {
  if (!content) return '';
  
  const c = content.content;
  if (!c) return '';
  
  if (content.type === 'prompt_pack' && c.usageGuide) {
    return `${c.title} - A premium collection of ${c.totalPrompts || 15} professionally crafted AI prompts. ${c.usageGuide.slice(0, 300)}`;
  }
  
  if (content.type === 'automation_kit' && c.description) {
    return `${c.title} - ${c.description}. Includes complete setup guide and workflow for ${c.platform || 'automation'}.`;
  }
  
  if (content.type === 'bundle' && c.description) {
    return `${c.title} - ${c.description}. ${c.totalValue || 'Premium bundle'} with ${c.items?.length || 0} items.`;
  }
  
  return '';
}


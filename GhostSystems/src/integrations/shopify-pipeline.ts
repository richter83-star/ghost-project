import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { validateJobData, isDescriptionMissing } from '../lib/validation.js';
import { generateDescription, generateImage } from '../lib/gemini.js';
import { createProduct, validateConfig as validateShopifyConfig } from '../lib/shopify.js';

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

  console.log(
    `[ShopifyPipeline] Processing DRAFT product: ${productId} - "${title}"`
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

    // Generate image if missing (optional - can be skipped if not needed)
    let imageUrl = validatedData.imageUrl;
    if (!imageUrl) {
      console.log(`[ShopifyPipeline] Image URL not provided for product ${productId}.`);
      // You can uncomment this to generate images automatically:
      // try {
      //   const imagePrompt = `${validatedData.title} - ${validatedData.productType}`;
      //   const base64Image = await generateImage(imagePrompt);
      //   // TODO: Upload base64Image to Firebase Storage or CDN, get URL
      //   // imageUrl = uploadedUrl;
      // } catch (error: any) {
      //   console.warn(`[ShopifyPipeline] Failed to generate image: ${error.message}`);
      // }
    }

    // Create product in Shopify
    console.log(`[ShopifyPipeline] Creating product in Shopify: ${productId}...`);
    const shopifyProductId = await createProduct({
      title: validatedData.title,
      description,
      productType: validatedData.productType,
      price: validatedData.price,
      imageUrl,
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
      ...(imageUrl && { imageUrl }),
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
    // Recursively process remaining items
    processQueue();
  } else {
    console.log('[ShopifyPipeline] ✅ Queue processing complete');
  }
}

/**
 * Start the Shopify product pipeline listener
 * Watches for products with status "draft" and processes them
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
    `[ShopifyPipeline] 📡 Listening for products with status = "draft" in collection "${collectionName}"...`
  );

  const productsRef = db.collection(collectionName);
  const query = productsRef.where('status', '==', 'draft');

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


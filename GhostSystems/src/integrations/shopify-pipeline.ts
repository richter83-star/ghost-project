import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { validateJobData, isDescriptionMissing } from '../lib/validation.js';
import { generateDescription, generateImage } from '../lib/gemini.js';
import { createProduct, validateConfig as validateShopifyConfig } from '../lib/shopify.js';

let db: FirebaseFirestore.Firestore | null = null;

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
      let draftCount = 0;

      snapshot.docChanges().forEach(async (change) => {
        // Only process newly added documents (not modifications)
        if (change.type !== 'added') return;

        draftCount++;
        const docSnap = change.doc;

        // Process in background (don't await - let listener continue)
        processDraftProduct(docSnap).catch((error) => {
          console.error(
            `[ShopifyPipeline] Unhandled error processing product ${docSnap.id}:`,
            error
          );
        });
      });

      if (draftCount > 0) {
        console.log(
          `[ShopifyPipeline] ✅ Processing ${draftCount} draft product(s)...`
        );
      }
    },
    (error) => {
      console.error('[ShopifyPipeline] ❌ Listener Error:', error);
    }
  );

  console.log('[ShopifyPipeline] 👻 Pipeline listener is active.');
}


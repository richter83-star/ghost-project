import type { DocumentReference } from 'firebase-admin/firestore';
import { db, FieldValue } from '../../firebase.js';
import config from '../../config.js';
import { validateJobData, isDescriptionMissing } from '../../validationService.js';
import { generateDescription, generateImage } from '../../geminiService.js';
import { createProduct } from '../../shopifyService.js';

const MAX_ERROR_LENGTH = 500;

function truncateError(error: any): string {
  const message = error?.message || error?.toString?.() || 'Unknown error';
  return message.slice(0, MAX_ERROR_LENGTH);
}

async function markError(docRef: DocumentReference, stage: string, error: any) {
  const lastErrorMessage = truncateError(error);
  await docRef.update({
    status: 'error',
    errorStage: stage,
    lastErrorAt: FieldValue.serverTimestamp(),
    lastErrorMessage,
    lastRunStatus: 'error',
    lastRunAt: FieldValue.serverTimestamp(),
  });
}

export async function processDraftProducts() {
  if (!db) {
    console.error('[GhostSystems][Worker] Firestore not initialized. Cannot process drafts.');
    return;
  }

  const collectionName = config.firebase.jobsCollection;
  const draftQuery = db
    .collection(collectionName)
    .where('status', '==', 'draft')
    .limit(10);

  const snapshot = await draftQuery.get();
  if (snapshot.empty) {
    console.log('[GhostSystems][Worker] No draft products found.');
    return;
  }

  for (const docSnap of snapshot.docs) {
    const docRef = docSnap.ref;
    const rawData = docSnap.data();
    const productId = docSnap.id;

    console.log(`[GhostSystems][Worker] Processing draft product ${productId}...`);

    if (rawData.shopifyProductId) {
      console.log(
        `[GhostSystems][Worker] Skipping ${productId} - already has Shopify ID ${rawData.shopifyProductId}`
      );
      continue;
    }

    let clean;
    try {
      clean = validateJobData(rawData);
    } catch (error) {
      console.error(`[GhostSystems][Worker] Validation failed for ${productId}: ${truncateError(error)}`);
      await markError(docRef, 'validation', error);
      continue;
    }

    // Ensure description exists
    if (isDescriptionMissing(clean.description)) {
      console.log(`[GhostSystems][Worker] Generating description for ${productId}...`);
      try {
        const generated = await generateDescription(clean);
        clean.description = generated;
        await docRef.update({
          description: generated,
          descriptionGeneratedAt: FieldValue.serverTimestamp(),
        });
        console.log(`[GhostSystems][Worker] Description generated for ${productId}.`);
      } catch (error) {
        console.error(`[GhostSystems][Worker] Description generation failed for ${productId}: ${truncateError(error)}`);
        await markError(docRef, 'description', error);
        continue;
      }
    }

    // Generate image prompt and attempt image generation
    let imageBase64: string | null = null;
    try {
      const imagePrompt = `High-quality digital product cover for "${clean.title}" (${clean.productType}). Dark background, clean lighting, no text or watermarks.`;
      imageBase64 = await generateImage(imagePrompt);
      // Avoid storing large base64 in Firestore; could be sent to CDN in future.
    } catch (error) {
      console.error(`[GhostSystems][Worker] Image generation failed for ${productId}: ${truncateError(error)}`);
      await markError(docRef, 'image', error);
      continue;
    }

    // Create product in Shopify
    try {
      const shopifyProductId = await createProduct({
        title: clean.title,
        description: clean.description,
        productType: clean.productType,
        price: clean.price,
        imageUrl: clean.imageUrl || null,
        imageBase64: imageBase64 || undefined,
      });

      await docRef.update({
        status: 'published',
        shopifyProductId,
        publishedAt: FieldValue.serverTimestamp(),
        lastRunStatus: 'success',
        lastRunAt: FieldValue.serverTimestamp(),
      });

      console.log(`[GhostSystems][Worker] Published ${productId} to Shopify with ID ${shopifyProductId}.`);
    } catch (error) {
      console.error(`[GhostSystems][Worker] Shopify publish failed for ${productId}: ${truncateError(error)}`);
      await markError(docRef, 'shopify', error);
      continue;
    }
  }
}

export default { processDraftProducts };

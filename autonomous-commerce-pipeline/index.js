import { db, FieldValue } from './firebase.js';
import { config } from './config.js';
import { validateJobData, isDescriptionMissing } from './services/validationService.js';
import { generateDescription, generateImage } from './services/geminiService.js'; // Import generateImage
import { createProduct } from './services/shopifyService.js';

const jobsRef = db.collection(config.firebase.jobsCollection);
// ... existing code ...
  });
}

// --- Core Processing Functions ---

/**
 * 1. Process Draft Job
 * Full pipeline: Fetches, validates, generates content, generates image, and publishes.
 * @param {string} id - Document ID.
 * @param {object} data - Document data.
 */
async function processDraftJob(id, data) {
  try {
    // 1. Set status to "processing" to lock the job
    await updateJobStatus(id, 'processing', { 
      processingStartedAt: FieldValue.serverTimestamp() 
    });

    // 2. Validate data
    const validatedData = validateJobData(data);
    let finalDescription = validatedData.description;

    // 3. Generate description if missing
    if (isDescriptionMissing(validatedData.description)) {
      console.log(`[${id}] Description missing. Generating...`);
      finalDescription = await generateDescription(validatedData);
      console.log(`[${id}] Description generated successfully.`);
    }

    // 4. Generate product image
    console.log(`[${id}] Generating product image...`);
    const imagePrompt = `A stunning, high-resolution, commercial product photo of: ${validatedData.title}. Clean studio background.`;
    const base64ImageData = await generateImage(imagePrompt);
    console.log(`[${id}] Image generated successfully.`);
    
    // 5. Set status to "publishing"
    await updateJobStatus(id, 'publishing', {
      description: finalDescription, // Update description if it was generated
      publishStartedAt: FieldValue.serverTimestamp(),
    });

    // 6. Call Shopify API to create product
    // We pass the full job data, plus the newly generated content
    const shopifyProductId = await createProduct(validatedData, finalDescription, base64ImageData);
    console.log(`[${id}] Successfully published to Shopify. Product ID: ${shopifyProductId}`);

    // 7. Set status to "published"
    await updateJobStatus(id, 'published', {
      shopifyProductId: shopifyProductId,
      publishedAt: FieldValue.serverTimestamp(),
    });

  } catch (error) {
    await handleJobError(id, 'Processing/Publishing', error);
  }
}

/**
 * 2. Finalize Job (Formerly 3)
// ... existing code ...
 * Moves the job to its final "completed" state.
 * @param {string} id - Document ID.
 */
// ... existing code ...
  }
}


// --- Firestore Listeners (The "State Machine") ---

function startListeners() {
  console.log('Starting Firestore listeners...');

  // Listener 1: "draft" -> "published"
  const draftQuery = jobsRef.where('status', '==', 'draft');
  draftQuery.onSnapshot(snapshot => {
// ... existing code ...
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added' || change.type === 'modified') {
        const doc = change.doc;
        console.log(`[${doc.id}] Detected 'draft' job. Starting full pipeline...`);
        processDraftJob(doc.id, doc.data()); // Renamed function
      }
    });
  }, err => {
// ... existing code ...
    console.error("Listener 'draft' failed: ", err);
  });

  // Listener 2: "validated" -> "published" (REMOVED)
  // This logic is now combined into the 'draft' listener.

  // Listener 3: "published" -> "completed"
  const publishedQuery = jobsRef.where('status', '==', 'published');
// ... existing code ...
}

// Start the application
startListeners();

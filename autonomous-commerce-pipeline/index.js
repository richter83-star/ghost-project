import { db, FieldValue } from './firebase.js';
import { config } from './config.js';
import { validateJobData, isDescriptionMissing } from './services/validationService.js';
import { generateDescription } from './services/geminiService.js';
import { createProduct } from './services/shopifyService.js';

const jobsRef = db.collection(config.firebase.jobsCollection);

// --- Helper Functions ---

/**
 * Centralized function to update job status and log metadata.
 * @param {string} id - Firestore document ID.
 * @param {string} status - The new status to set.
 * @param {object} additionalData - Any other data to merge (e.g., shopifyId, error).
 */
async function updateJobStatus(id, status, additionalData = {}) {
  const logEntry = {
    status,
    timestamp: FieldValue.serverTimestamp(),
    ...additionalData,
  };

  // Add all details to a 'logs' subcollection for a clean history
  const logRef = jobsRef.doc(id).collection('logs').doc();
  
  // Update the main document
  const jobRef = jobsRef.doc(id);

  await db.batch()
    .set(logRef, logEntry) // Write to log subcollection
    .update(jobRef, {      // Update main doc
      status: status,
      lastUpdatedAt: FieldValue.serverTimestamp(),
      ...additionalData,
      // Clear error on successful progression
      ...(status !== 'error' && { errorDetails: FieldValue.delete() })
    })
    .commit();
  
  console.log(`[${id}] Status changed to -> ${status}`);
}

/**
 * Centralized error handler.
 * @param {string} id - Firestore document ID.
 * @param {string} step - The step that failed (e.g., "Validation").
 * @param {string} error - The error message.
 */
async function handleJobError(id, step, error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error(`[${id}] ERROR at step [${step}]: ${errorMessage}`);
  await updateJobStatus(id, 'error', {
    errorDetails: {
      step: step,
      message: errorMessage,
      failedAt: new Date().toISOString(),
    },
  });
}

// --- Core Processing Functions ---

/**
 * 1. Validate Job
 * Fetches, validates, and generates missing descriptions.
 * @param {string} id - Document ID.
 * @param {object} data - Document data.
 */
async function processAndValidateJob(id, data) {
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

    // 4. Set status to "validated"
    await updateJobStatus(id, 'validated', {
      description: finalDescription, // Update description if it was generated
      validatedAt: FieldValue.serverTimestamp(),
    });

  } catch (error) {
    await handleJobError(id, 'Validation', error);
  }
}

/**
 * 2. Publish to Shopify
 * Takes validated data and creates the product in Shopify.
 * @param {string} id - Document ID.
 * @param {object} data - Document data.
 */
async function publishJobToShopify(id, data) {
  try {
    // 1. Set status to "publishing"
    await updateJobStatus(id, 'publishing', {
      publishStartedAt: FieldValue.serverTimestamp()
    });

    // 2. Call Shopify API
    const shopifyProductId = await createProduct(data);
    console.log(`[${id}] Successfully published to Shopify. Product ID: ${shopifyProductId}`);

    // 3. Set status to "published"
    await updateJobStatus(id, 'published', {
      shopifyProductId: shopifyProductId,
      publishedAt: FieldValue.serverTimestamp(),
    });

  } catch (error) {
    await handleJobError(id, 'Shopify Publishing', error);
  }
}

/**
 * 3. Finalize Job
 * Moves the job to its final "completed" state.
 * @param {string} id - Document ID.
 */
async function completeJob(id) {
  try {
    // 1. Set status to "completed"
    await updateJobStatus(id, 'completed', {
      completedAt: FieldValue.serverTimestamp()
    });
    console.log(`[${id}] Job completed and finalized.`);
  } catch (error) {
    await handleJobError(id, 'Completion', error);
  }
}


// --- Firestore Listeners (The "State Machine") ---

function startListeners() {
  console.log('Starting Firestore listeners...');

  // Listener 1: "draft" -> "validated"
  const draftQuery = jobsRef.where('status', '==', 'draft');
  draftQuery.onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added' || change.type === 'modified') {
        const doc = change.doc;
        console.log(`[${doc.id}] Detected 'draft' job. Starting validation...`);
        processAndValidateJob(doc.id, doc.data());
      }
    });
  }, err => {
    console.error("Listener 'draft' failed: ", err);
  });

  // Listener 2: "validated" -> "published"
  const validatedQuery = jobsRef.where('status', '==', 'validated');
  validatedQuery.onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added' || change.type === 'modified') {
        const doc = change.doc;
        console.log(`[${doc.id}] Detected 'validated' job. Publishing to Shopify...`);
        publishJobToShopify(doc.id, doc.data());
      }
    });
  }, err => {
    console.error("Listener 'validated' failed: ", err);
  });

  // Listener 3: "published" -> "completed"
  const publishedQuery = jobsRef.where('status', '==', 'published');
  publishedQuery.onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added' || change.type === 'modified') {
        const doc = change.doc;
        console.log(`[${doc.id}] Detected 'published' job. Finalizing...`);
        completeJob(doc.id);
      }
    });
  }, err => {
    console.error("Listener 'published' failed: ", err);
  });

  // (Optional) Listener 4: Monitor for errors
  const errorQuery = jobsRef.where('status', '==', 'error');
  errorQuery.onSnapshot(snapshot => {
    snapshot.docChanges().forEach(change => {
      if (change.type === 'added' || change.type === 'modified') {
        console.warn(`[${change.doc.id}] Job has entered ERROR state. Manual review required.`);
        // You could add alerting (e.g., email, Slack) here.
      }
    });
  }, err => {
    console.error("Listener 'error' failed: ", err);
  });
}

// Start the application
startListeners();
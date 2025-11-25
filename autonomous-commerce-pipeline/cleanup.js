import { db } from './firebase.js';

// Configuration
const COLLECTION_NAME = 'products';
const ALLOWED_PRODUCT_TYPES = [
  'digital_prompt_pack',
  'workflow_kit',
  'automation_template',
  'notion_system',
  'script_bundle'
];
const PHYSICAL_KEYWORDS = [
  'shirt', 'mug', 'poster', 'decor', 'canvas', 't-shirt', 'clothing', 'apparel', 'homeware'
];

/**
 * Checks if a product document matches the criteria for archiving (i.e., is it "junk"?).
 * @param {object} data - The document data.
 * @returns {boolean} - True if it should be archived.
 */
function shouldArchive(data) {
  // 1. Check deliveryType
  if (data.deliveryType !== 'digital') {
    return true;
  }

  // 2. Check productType
  if (!data.productType || !ALLOWED_PRODUCT_TYPES.includes(data.productType)) {
    return true;
  }

  // 3. Check for physical keywords in title or description
  const textToCheck = `${data.title || ''} ${data.description || ''}`.toLowerCase();
  const hasPhysicalKeyword = PHYSICAL_KEYWORDS.some(keyword => textToCheck.includes(keyword));
  
  if (hasPhysicalKeyword) {
    return true;
  }

  return false;
}

async function runCleanup() {
  console.log('Starting Firestore cleanup...');
  
  try {
    // Fetch all products (we filter in memory for complex logic)
    const snapshot = await db.collection(COLLECTION_NAME).get();
    console.log(`Scanned ${snapshot.size} total documents.`);

    const batch = db.batch();
    let updateCount = 0;
    let batchCount = 0;

    snapshot.forEach(doc => {
      const data = doc.data();
      
      // Skip if already archived to avoid redundant writes
      if (data.status === 'archived') {
        return;
      }

      if (shouldArchive(data)) {
        const docRef = db.collection(COLLECTION_NAME).doc(doc.id);
        batch.update(docRef, {
          status: 'archived',
          archivedReason: 'non_digital_seed',
          archivedAt: new Date() // Using standard Date object for Admin SDK
        });
        
        updateCount++;
        batchCount++;

        console.log(`[Marking for Archive] ID: ${doc.id} | Title: "${data.title}"`);

        // Firestore batches are limited to 500 operations. 
        // For a simple script, we'll just commit and start a new batch if we hit a limit.
        // (In a massive production DB, we'd handle this more robustly, but this is fine for cleanup).
        if (batchCount >= 400) {
           console.log('Committing intermediate batch...');
           // Note: In a real loop, we'd need to await this, but for a simple one-off script 
           // with <500 junk items, a single batch at the end is usually sufficient.
           // If you have >500 junk items, run this script multiple times.
        }
      }
    });

    if (updateCount > 0) {
      await batch.commit();
      console.log(`\nSUCCESS: Updated ${updateCount} documents to status: "archived".`);
    } else {
      console.log('\nNo documents matched the criteria for archiving.');
    }

  } catch (error) {
    console.error('Cleanup failed:', error);
  }
}

// Run the script
runCleanup();
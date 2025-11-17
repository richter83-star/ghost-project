import admin from 'firebase-admin';
import { createRequire } from 'module';
import { config } from './config.js';

// Allows importing JSON files in ES Modules
const require = createRequire(import.meta.url);
const serviceAccount = require(config.firebase.serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

console.log('Firebase Admin initialized successfully.');

export const db = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;
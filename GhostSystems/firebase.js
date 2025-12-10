import admin from 'firebase-admin';
import config from './config.js';

const serviceAccount = JSON.parse(config.firebase.serviceAccountJson);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

export { db, FieldValue };
export default { db, FieldValue };

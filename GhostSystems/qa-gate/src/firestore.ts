import fs from "node:fs";
import admin from "firebase-admin";
import { config } from "./config.js";

function loadServiceAccount(): admin.ServiceAccount {
  if (config.firebase.serviceAccountJson) {
    try {
      return JSON.parse(config.firebase.serviceAccountJson) as admin.ServiceAccount;
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
    }
  }

  if (config.firebase.serviceAccountPath) {
    const raw = fs.readFileSync(config.firebase.serviceAccountPath, "utf8");
    return JSON.parse(raw) as admin.ServiceAccount;
  }

  throw new Error("Provide FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH.");
}

let app: admin.app.App | null = null;

export function getDb() {
  if (!app) {
    const serviceAccount = loadServiceAccount();
    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: config.firebase.projectId
    });
  }
  return admin.firestore();
}


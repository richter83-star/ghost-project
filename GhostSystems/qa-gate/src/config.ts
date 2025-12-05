import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  FIREBASE_PROJECT_ID: z.string().min(1),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),

  FIRESTORE_JOBS_COLLECTION: z.string().default("products"),

  QA_SCAN_STATUSES: z.string().default("pending,draft"),
  QA_WRITE_STATUS: z.string().default("true"),
  QA_PASSED_STATUS: z.string().default("qa_passed"),
  QA_FAILED_STATUS: z.string().default("qa_failed"),

  QA_BATCH_LIMIT: z.string().default("25"),
  QA_SCAN_CRON: z.string().default("*/15 * * * *"),

  QA_MIN_ARTIFACT_BYTES: z.string().default("5000"),
  QA_REQUIRE_README_IN_ZIP: z.string().default("true"),

  QA_HTTP_ENABLED: z.string().default("false"),
  QA_HTTP_PORT: z.string().default("8089")
});

const env = schema.parse(process.env);

export const config = {
  firebase: {
    projectId: env.FIREBASE_PROJECT_ID,
    serviceAccountJson: env.FIREBASE_SERVICE_ACCOUNT_JSON,
    serviceAccountPath: env.FIREBASE_SERVICE_ACCOUNT_PATH
  },
  firestore: {
    collectionName: env.FIRESTORE_JOBS_COLLECTION
  },
  qa: {
    scanStatuses: env.QA_SCAN_STATUSES.split(",").map(s => s.trim()).filter(Boolean),
    writeStatus: env.QA_WRITE_STATUS.toLowerCase() === "true",
    passedStatus: env.QA_PASSED_STATUS,
    failedStatus: env.QA_FAILED_STATUS,
    batchLimit: Number(env.QA_BATCH_LIMIT),
    scanCron: env.QA_SCAN_CRON,
    minArtifactBytes: Number(env.QA_MIN_ARTIFACT_BYTES),
    requireReadmeInZip: env.QA_REQUIRE_README_IN_ZIP.toLowerCase() === "true"
  },
  http: {
    enabled: env.QA_HTTP_ENABLED.toLowerCase() === "true",
    port: Number(env.QA_HTTP_PORT)
  }
};


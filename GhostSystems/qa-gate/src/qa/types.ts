export type QaStatus = "passed" | "failed";

export type QaResult = {
  status: QaStatus;
  score: number;               // 0-100
  fail_reasons: string[];      // canonical strings
  concept_key: string;         // normalized concept key for dedupe
  checked_at: string;          // ISO timestamp
  details?: Record<string, unknown>;
};


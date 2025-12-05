import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { config } from "../config.js";

type ArtifactCheck = {
  present: boolean;
  sizeBytes?: number;
  hasReadme?: boolean;
  promptCountDetected?: number;
  notes: string[];
};

async function headContentLength(url: string, timeoutMs = 8000): Promise<number | null> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "HEAD", signal: ctrl.signal });
    const len = res.headers.get("content-length");
    if (!len) return null;
    const n = Number(len);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

function detectCountFromJsonFile(filePath: string): number | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const obj = JSON.parse(raw);
    if (Array.isArray(obj)) return obj.length;
    if (Array.isArray(obj?.prompts)) return obj.prompts.length;
    return null;
  } catch {
    return null;
  }
}

function detectCountFromTextFile(filePath: string): number | null {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;
    // crude heuristic: prompts are usually one per line for packs
    return lines.length;
  } catch {
    return null;
  }
}

function checkZip(zipPath: string) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries().map(e => e.entryName);
  const lower = entries.map(e => e.toLowerCase());

  const hasReadme =
    lower.some(e => e.endsWith("readme.md")) ||
    lower.some(e => e.endsWith("readme.txt")) ||
    lower.some(e => e.includes("readme"));

  // Try to locate a prompts file
  let promptCountDetected: number | null = null;

  const promptsJsonIdx = lower.findIndex(e => e.endsWith("prompts.json"));
  if (promptsJsonIdx >= 0) {
    const entry = zip.getEntry(entries[promptsJsonIdx]);
    if (entry) {
      const raw = entry.getData().toString("utf8");
      try {
        const obj = JSON.parse(raw);
        if (Array.isArray(obj)) promptCountDetected = obj.length;
        else if (Array.isArray((obj as any).prompts)) promptCountDetected = (obj as any).prompts.length;
      } catch {
        // ignore
      }
    }
  }

  if (promptCountDetected == null) {
    const promptsTxtIdx = lower.findIndex(e => e.endsWith("prompts.txt"));
    if (promptsTxtIdx >= 0) {
      const entry = zip.getEntry(entries[promptsTxtIdx]);
      if (entry) {
        const raw = entry.getData().toString("utf8");
        const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
        if (lines.length > 0) promptCountDetected = lines.length;
      }
    }
  }

  return { hasReadme, promptCountDetected };
}

export async function inspectArtifact(input: {
  artifact_path?: string | null;
  artifact_url?: string | null;
}) : Promise<ArtifactCheck> {
  const notes: string[] = [];
  const artifactPath = input.artifact_path ?? null;
  const artifactUrl = input.artifact_url ?? null;

  if (artifactPath) {
    const abs = path.resolve(artifactPath);
    if (!fs.existsSync(abs)) {
      return { present: false, notes: [`artifact_path missing on disk: ${abs}`] };
    }
    const st = fs.statSync(abs);
    const sizeBytes = st.size;

    if (sizeBytes < config.qa.minArtifactBytes) {
      notes.push(`artifact too small (${sizeBytes} bytes)`);
    }

    const ext = path.extname(abs).toLowerCase();
    let hasReadme: boolean | undefined;
    let promptCountDetected: number | undefined;

    if (ext === ".zip") {
      const { hasReadme: hr, promptCountDetected: pc } = checkZip(abs);
      hasReadme = hr;
      if (pc != null) promptCountDetected = pc;
      if (config.qa.requireReadmeInZip && !hasReadme) {
        notes.push("zip missing README");
      }
    } else if (ext === ".json") {
      const c = detectCountFromJsonFile(abs);
      if (c != null) promptCountDetected = c;
    } else if (ext === ".txt" || ext === ".md") {
      const c = detectCountFromTextFile(abs);
      if (c != null) promptCountDetected = c;
    } else {
      notes.push(`artifact type ${ext} not content-inspected`);
    }

    return { present: true, sizeBytes, hasReadme, promptCountDetected, notes };
  }

  if (artifactUrl) {
    const len = await headContentLength(artifactUrl);
    if (len == null) {
      return { present: true, notes: ["artifact_url reachable unknown size (no content-length)"] };
    }
    const sizeBytes = len;
    if (sizeBytes < config.qa.minArtifactBytes) {
      notes.push(`artifact_url too small (${sizeBytes} bytes)`);
    }
    return { present: true, sizeBytes, notes };
  }

  return { present: false, notes: ["no artifact_path or artifact_url present"] };
}


import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Raíz del repo (scripts/lib → ../..) */
export const SCRIPTS_ROOT = path.resolve(__dirname, "../..");

/** @param {{ skipKeys?: string[] }} [opts] */
export function loadEnvLocal(opts = {}) {
  const skip = new Set(opts.skipKeys ?? []);
  const envPath = path.join(SCRIPTS_ROOT, ".env.local");
  if (!fs.existsSync(envPath)) {
    console.warn(`Aviso: no existe ${envPath}`);
    return;
  }
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (skip.has(key)) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

export function parseMongoUriArg(argv = process.argv.slice(2)) {
  for (const arg of argv) {
    if (arg.startsWith("--mongodb-uri=")) {
      return arg.slice("--mongodb-uri=".length).trim();
    }
  }
  return undefined;
}

export function maskMongoUri(uri) {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");
}

export function normalizePrivateKey(key) {
  return key.replace(/\\n/g, "\n");
}

export function isDataUrl(ref) {
  return typeof ref === "string" && ref.startsWith("data:");
}

export function isGcsObjectKey(ref) {
  return typeof ref === "string" && ref.startsWith("records/") && !ref.startsWith("http");
}

export function parseDataUrl(dataUrl) {
  const m = dataUrl.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (!m) throw new Error("Data URL inválida");
  return { mimeType: m[1], buffer: Buffer.from(m[2], "base64") };
}

export function mimeToExt(mimeType) {
  const m = mimeType.toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("webp")) return "webp";
  if (m.includes("png")) return "png";
  return "jpg";
}

export function recordImageObjectKey(recordId, imageId, variant, ext) {
  return `records/${recordId}/${imageId}/${variant}.${ext}`;
}

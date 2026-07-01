#!/usr/bin/env node
/* eslint-disable */
// @ts-nocheck
/**
 * Migra imágenes base64 almacenadas en MongoDB → Google Cloud Storage.
 *
 * Uso:
 *   node scripts/migrate-images-to-gcs.mjs --dry-run --mongodb-uri="mongodb+srv://..."
 *   node scripts/migrate-images-to-gcs.mjs --mongodb-uri="mongodb+srv://..."
 *   node scripts/migrate-images-to-gcs.mjs --record-id=<uuid> --mongodb-uri="..."
 *
 * MongoDB:
 *   La URI NO se lee de .env.local (para no mezclar Atlas con dev local).
 *   Pásala con --mongodb-uri=... o define MONGODB_URI en el entorno del shell.
 *
 * GCS (desde .env.local o entorno):
 *   GCS_BUCKET, GCS_PROJECT_ID, GCS_CLIENT_EMAIL, GCS_PRIVATE_KEY
 *   — o bien GCS_SERVICE_ACCOUNT_JSON en una línea.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import { Storage } from "@google-cloud/storage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const COLLECTION = "records";

/** Claves que el script no carga desde .env.local */
const SKIP_FROM_ENV_LOCAL = new Set(["MONGODB_URI"]);

function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (SKIP_FROM_ENV_LOCAL.has(key)) continue;
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

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  let recordId;
  let mongodbUri;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--record-id=")) {
      recordId = arg.slice("--record-id=".length).trim();
    }
    if (arg.startsWith("--mongodb-uri=")) {
      mongodbUri = arg.slice("--mongodb-uri=".length).trim();
    }
  }
  return { dryRun, recordId, mongodbUri };
}

function normalizePrivateKey(key) {
  return key.replace(/\\n/g, "\n");
}

function getGcsCredentials() {
  const json = process.env.GCS_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    const parsed = JSON.parse(json);
    return {
      project_id: parsed.project_id,
      client_email: parsed.client_email,
      private_key: normalizePrivateKey(parsed.private_key),
    };
  }

  const email = process.env.GCS_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GCS_PRIVATE_KEY?.trim();
  if (email && privateKey) {
    return {
      project_id: process.env.GCS_PROJECT_ID?.trim(),
      client_email: email,
      private_key: normalizePrivateKey(privateKey),
    };
  }

  return null;
}

function isDataUrl(ref) {
  return typeof ref === "string" && ref.startsWith("data:");
}

function isGcsObjectKey(ref) {
  return typeof ref === "string" && ref.startsWith("records/") && !ref.startsWith("http");
}

function parseDataUrl(dataUrl) {
  const m = dataUrl.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (!m) throw new Error("Data URL inválida");
  return { mimeType: m[1], buffer: Buffer.from(m[2], "base64") };
}

function mimeToExt(mimeType) {
  const m = mimeType.toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("webp")) return "webp";
  if (m.includes("png")) return "png";
  return "jpg";
}

function recordImageObjectKey(recordId, imageId, variant, ext) {
  return `records/${recordId}/${imageId}/${variant}.${ext}`;
}

function getStorage() {
  const bucket = process.env.GCS_BUCKET?.trim();
  if (!bucket) throw new Error("GCS_BUCKET no definido");

  const credentials = getGcsCredentials();
  const options = {};
  if (credentials) {
    options.projectId =
      process.env.GCS_PROJECT_ID?.trim() ?? credentials.project_id;
    options.credentials = {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    };
  } else if (process.env.GCS_PROJECT_ID?.trim()) {
    options.projectId = process.env.GCS_PROJECT_ID.trim();
  } else {
    throw new Error(
      "Credenciales GCS no definidas. Usa GCS_CLIENT_EMAIL + GCS_PRIVATE_KEY o GCS_SERVICE_ACCOUNT_JSON."
    );
  }

  return { storage: new Storage(options), bucketName: bucket };
}

async function uploadBuffer(storage, bucketName, objectKey, buffer, contentType) {
  const file = storage.bucket(bucketName).file(objectKey);
  await file.save(buffer, {
    contentType,
    resumable: false,
    metadata: { cacheControl: "private, max-age=3600" },
  });
}

async function migrateImageRef(storage, bucketName, dataUrl, objectKey, dryRun) {
  const { mimeType, buffer } = parseDataUrl(dataUrl);
  const sizeKb = Math.round(buffer.length / 1024);
  if (dryRun) {
    return { objectKey, sizeKb, uploaded: false };
  }
  await uploadBuffer(storage, bucketName, objectKey, buffer, mimeType);
  return { objectKey, sizeKb, uploaded: true };
}

async function main() {
  loadEnvLocal();
  const { dryRun, recordId, mongodbUri } = parseArgs();

  const uri = mongodbUri?.trim() || process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error(
      "URI de Mongo requerida.\n" +
        "  --mongodb-uri=\"mongodb+srv://...\"\n" +
        "  o define MONGODB_URI en el entorno del shell.\n" +
        "  (No se lee MONGODB_URI desde .env.local en este script.)"
    );
  }

  const { storage, bucketName } = getStorage();
  console.log(`Bucket: ${bucketName}`);
  console.log(`Mongo:  ${uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@")}`);
  console.log(dryRun ? "Modo: DRY RUN (no escribe)" : "Modo: MIGRACIÓN REAL");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const col = db.collection(COLLECTION);

  const query = recordId ? { id: recordId } : {};
  const records = await col.find(query).toArray();
  console.log(`Registros a revisar: ${records.length}`);

  let migratedRecords = 0;
  let migratedImages = 0;
  let skippedImages = 0;
  let totalKb = 0;

  for (const record of records) {
    const images = record.images ?? [];
    if (images.length === 0) continue;

    let recordChanged = false;
    const nextImages = [];

    for (const img of images) {
      const next = { ...img };

      if (isDataUrl(img.url)) {
        const { mimeType } = parseDataUrl(img.url);
        const ext = mimeToExt(mimeType);
        const key = recordImageObjectKey(record.id, img.id, "original", ext);
        const result = await migrateImageRef(
          storage,
          bucketName,
          img.url,
          key,
          dryRun
        );
        next.url = key;
        totalKb += result.sizeKb;
        migratedImages += 1;
        recordChanged = true;
        console.log(
          `  [${record.id}] ${img.id} original → ${key} (${result.sizeKb} KB)`
        );
      } else if (isGcsObjectKey(img.url)) {
        skippedImages += 1;
      }

      if (img.processedUrl && isDataUrl(img.processedUrl)) {
        const { mimeType } = parseDataUrl(img.processedUrl);
        const ext = mimeToExt(mimeType);
        const key = recordImageObjectKey(record.id, img.id, "processed", ext);
        const result = await migrateImageRef(
          storage,
          bucketName,
          img.processedUrl,
          key,
          dryRun
        );
        next.processedUrl = key;
        totalKb += result.sizeKb;
        migratedImages += 1;
        recordChanged = true;
        console.log(
          `  [${record.id}] ${img.id} processed → ${key} (${result.sizeKb} KB)`
        );
      } else if (img.processedUrl && isGcsObjectKey(img.processedUrl)) {
        skippedImages += 1;
      }

      nextImages.push(next);
    }

    if (recordChanged) {
      migratedRecords += 1;
      if (!dryRun) {
        await col.updateOne(
          { id: record.id },
          { $set: { images: nextImages, updatedAt: new Date().toISOString() } }
        );
      }
    }
  }

  await client.close();

  console.log("\n--- Resumen ---");
  console.log(`Registros migrados: ${migratedRecords}`);
  console.log(`Imágenes subidas:   ${migratedImages}`);
  console.log(`Referencias ya GCS: ${skippedImages}`);
  console.log(`Datos movidos:      ~${Math.round(totalKb / 1024)} MB`);
  if (dryRun) {
    console.log("\nEjecuta sin --dry-run para aplicar los cambios.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

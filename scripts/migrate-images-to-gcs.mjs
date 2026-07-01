#!/usr/bin/env node
/* eslint-disable */
// @ts-nocheck
/**
 * Migra imágenes base64 en MongoDB → Google Cloud Storage.
 *
 * IMPORTANTE: al terminar, Mongo deja de guardar base64. Cada images[].url y
 * images[].processedUrl pasa a ser una clave GCS (records/{recordId}/...).
 *
 * Uso:
 *   node scripts/migrate-images-to-gcs.mjs --dry-run --mongodb-uri="..."
 *   node scripts/migrate-images-to-gcs.mjs --mongodb-uri="..."
 *
 * Auditar base64 restante:
 *   node scripts/audit-mongo-images.mjs --mongodb-uri="..."
 */

import { MongoClient } from "mongodb";
import { Storage } from "@google-cloud/storage";
import path from "node:path";
import {
  loadEnvLocal,
  SCRIPTS_ROOT,
  isDataUrl,
  isGcsObjectKey,
  parseDataUrl,
  mimeToExt,
  recordImageObjectKey,
  normalizePrivateKey,
  maskMongoUri,
} from "./lib/mongo-script-utils.mjs";

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

const COLLECTION = "records";

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

function assertGcsEnv() {
  const bucket = process.env.GCS_BUCKET?.trim();
  if (!bucket) {
    throw new Error(
      "GCS_BUCKET no definido. Agrégalo en .env.local en la raíz del proyecto " +
        `(esperado: ${path.join(SCRIPTS_ROOT, ".env.local")})`
    );
  }
  const creds = getGcsCredentials();
  if (!creds) {
    throw new Error(
      "Credenciales GCS no definidas en .env.local (GCS_CLIENT_EMAIL + GCS_PRIVATE_KEY " +
        "o GCS_SERVICE_ACCOUNT_JSON)."
    );
  }
  return bucket;
}

function getStorage() {
  const bucket = assertGcsEnv();
  const credentials = getGcsCredentials();
  const options = {
    projectId: process.env.GCS_PROJECT_ID?.trim() ?? credentials.project_id,
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
  };
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

async function objectExists(storage, bucketName, objectKey) {
  const [exists] = await storage.bucket(bucketName).file(objectKey).exists();
  return exists;
}

async function migrateImageRef(storage, bucketName, dataUrl, objectKey, dryRun) {
  const { mimeType, buffer } = parseDataUrl(dataUrl);
  const sizeKb = Math.round(buffer.length / 1024);
  if (dryRun) {
    return { objectKey, sizeKb, uploaded: false, skippedUpload: false };
  }
  const exists = await objectExists(storage, bucketName, objectKey);
  if (!exists) {
    await uploadBuffer(storage, bucketName, objectKey, buffer, mimeType);
    return { objectKey, sizeKb, uploaded: true, skippedUpload: false };
  }
  return { objectKey, sizeKb, uploaded: false, skippedUpload: true };
}

async function main() {
  loadEnvLocal({ skipKeys: ["MONGODB_URI"] });
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

  if (uri.includes("<db_password>") || uri.includes("<password>")) {
    throw new Error(
      "La URI aún tiene el placeholder <db_password>. Reemplázalo por tu contraseña real de Atlas."
    );
  }

  if (!uri.match(/\/[^/?]+(\?|$)/) && uri.includes("27017")) {
    console.warn(
      "Aviso: la URI no incluye nombre de base (ej. /proyectoisaqwen). " +
        "Atlas suele usar /proyectoisaqwen antes del ?."
    );
  }

  const { storage, bucketName } = getStorage();
  console.log(`Bucket: ${bucketName}`);
  console.log(`Mongo:  ${maskMongoUri(uri)}`);
  console.log(dryRun ? "Modo: DRY RUN (no escribe)" : "Modo: MIGRACIÓN REAL");

  const client = new MongoClient(uri);
  try {
    console.log("Conectando a MongoDB...");
    await client.connect();
    console.log("Conectado.");
  } catch (err) {
    if (err?.code === "ECONNREFUSED" && err?.syscall === "querySrv") {
      console.error(
        "\nNo se pudo resolver DNS SRV de MongoDB Atlas desde esta máquina/red."
      );
      console.error("Opciones:");
      console.error(
        "  1. Atlas → Connect → Drivers → copia la URI estándar (mongodb://..., no mongodb+srv://)"
      );
      console.error(
        "  2. Cambia DNS a 8.8.8.8 / 1.1.1.1 y reintenta"
      );
      console.error(
        "  3. Ejecuta desde Railway (donde Mongo ya funciona): railway run npm run migrate:images:gcs"
      );
    }
    if (err?.code === 8000 || err?.codeName === "AtlasError") {
      console.error(
        "\nAutenticación fallida. Revisa usuario/contraseña y que la URI incluya /proyectoisaqwen"
      );
      console.error(
        "Si la contraseña tiene caracteres especiales (@ # % etc.), codifícala en URL (encodeURIComponent)."
      );
    }
    throw err;
  }
  const db = client.db();
  const col = db.collection(COLLECTION);

  const query = recordId ? { id: recordId } : {};
  console.log(
    "Descargando registros desde Atlas (puede tardar varios minutos: ~29 MB de imágenes base64 en Mongo)..."
  );
  const records = await col.find(query).toArray();
  console.log(`Registros descargados: ${records.length}. Procesando imágenes...`);

  let migratedRecords = 0;
  let migratedImages = 0;
  let skippedImages = 0;
  let mongoFieldsCleaned = 0;
  let totalKb = 0;

  for (const record of records) {
    const images = record.images ?? [];
    if (images.length === 0) continue;

    console.log(`Registro ${record.id} (${images.length} imagen/es)...`);

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
        mongoFieldsCleaned += 1;
        recordChanged = true;
        const tag = result.skippedUpload ? "ya en GCS, limpiando Mongo" : "subida";
        console.log(
          `  [${record.id}] ${img.id} original → ${key} (${result.sizeKb} KB, ${tag})`
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
        mongoFieldsCleaned += 1;
        recordChanged = true;
        const tag = result.skippedUpload ? "ya en GCS, limpiando Mongo" : "subida";
        console.log(
          `  [${record.id}] ${img.id} processed → ${key} (${result.sizeKb} KB, ${tag})`
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
  console.log(`Registros actualizados en Mongo: ${migratedRecords}`);
  console.log(`Imágenes procesadas:            ${migratedImages}`);
  console.log(`Campos base64 → clave GCS:    ${mongoFieldsCleaned}`);
  console.log(`Referencias ya en GCS:        ${skippedImages}`);
  console.log(`Datos movidos a bucket:       ~${Math.round(totalKb / 1024)} MB`);
  if (!dryRun && migratedRecords > 0) {
    console.log(
      "\nMongo ya no guarda base64 en esos registros (solo claves records/...)."
    );
    console.log(
      "Verifica con: node scripts/audit-mongo-images.mjs --mongodb-uri=\"...\""
    );
  }
  if (dryRun) {
    console.log("\nDry-run: no se escribió GCS ni Mongo. Quita --dry-run para limpiar.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
/* eslint-disable */
// @ts-nocheck
/**
 * Configura CORS en el bucket GCS para subida directa desde el navegador (PUT).
 *
 * Uso:
 *   node scripts/setup-gcs-cors.mjs --bucket=404lab --origin=https://tu-app.railway.app
 *   node scripts/setup-gcs-cors.mjs --bucket=404lab --origin=http://localhost:3000
 *
 * Repite --origin por cada origen permitido (prod + localhost).
 */

import { Storage } from "@google-cloud/storage";
import {
  loadEnvLocal,
  normalizePrivateKey,
} from "./lib/mongo-script-utils.mjs";

function parseArgs() {
  let bucket;
  const origins = [];
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--bucket=")) {
      bucket = arg.slice("--bucket=".length).trim();
    } else if (arg.startsWith("--origin=")) {
      origins.push(arg.slice("--origin=".length).trim());
    }
  }
  return { bucket, origins };
}

function getStorageClient() {
  const json = process.env.GCS_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    const parsed = JSON.parse(json);
    return new Storage({
      projectId: parsed.project_id,
      credentials: {
        client_email: parsed.client_email,
        private_key: normalizePrivateKey(parsed.private_key),
      },
    });
  }
  const email = process.env.GCS_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GCS_PRIVATE_KEY?.trim();
  if (email && privateKey) {
    return new Storage({
      projectId: process.env.GCS_PROJECT_ID?.trim(),
      credentials: {
        client_email: email,
        private_key: normalizePrivateKey(privateKey),
      },
    });
  }
  return new Storage();
}

async function main() {
  loadEnvLocal();
  const { bucket: bucketArg, origins } = parseArgs();
  const bucketName = bucketArg ?? process.env.GCS_BUCKET?.trim();
  if (!bucketName) {
    console.error("Indica --bucket= o GCS_BUCKET en el entorno");
    process.exit(1);
  }
  if (origins.length === 0) {
    console.error("Indica al menos un --origin= (URL del frontend)");
    process.exit(1);
  }

  const storage = getStorageClient();
  const bucket = storage.bucket(bucketName);

  const cors = [
    {
      origin: origins,
      method: ["GET", "PUT", "HEAD", "OPTIONS"],
      responseHeader: ["Content-Type", "Content-Length", "x-goog-resumable"],
      maxAgeSeconds: 3600,
    },
  ];

  await bucket.setCorsConfiguration(cors);
  console.log(`CORS aplicado en gs://${bucketName}:`);
  console.log(JSON.stringify(cors, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

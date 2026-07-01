#!/usr/bin/env node
/* eslint-disable */
// @ts-nocheck
/**
 * Audita y limpia imágenes base64 que aún queden en MongoDB tras migrar a GCS.
 *
 * Uso:
 *   node scripts/audit-mongo-images.mjs --mongodb-uri="mongodb://..."
 *   node scripts/audit-mongo-images.mjs --mongodb-uri="..." --fix
 *
 * --fix ejecuta migrate-images-to-gcs.mjs (sube a GCS y REEMPLAZA base64 por claves).
 * Sin --fix solo reporta cuánto base64 queda.
 */

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";
import { loadEnvLocal, parseMongoUriArg, maskMongoUri } from "./lib/mongo-script-utils.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const COLLECTION = "records";

function parseArgs() {
  const fix = process.argv.includes("--fix");
  let mongodbUri;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--mongodb-uri=")) {
      mongodbUri = arg.slice("--mongodb-uri=".length).trim();
    }
  }
  return { fix, mongodbUri };
}

function estimateDataUrlBytes(dataUrl) {
  const m = dataUrl.match(/^data:[^;]+;base64,([\s\S]*)$/);
  if (!m) return 0;
  return Math.round((m[1].length * 3) / 4);
}

async function audit(col) {
  const cursor = col.find(
    {
      $or: [
        { "images.url": { $regex: "^data:" } },
        { "images.processedUrl": { $regex: "^data:" } },
      ],
    },
    { projection: { id: 1, images: 1 } }
  );

  let records = 0;
  let refs = 0;
  let bytes = 0;
  const samples = [];

  for await (const doc of cursor) {
    records += 1;
    for (const img of doc.images ?? []) {
      for (const field of ["url", "processedUrl"]) {
        const ref = img[field];
        if (typeof ref === "string" && ref.startsWith("data:")) {
          refs += 1;
          bytes += estimateDataUrlBytes(ref);
        }
      }
    }
    if (samples.length < 5) samples.push(doc.id);
  }

  const alreadyGcs = await col.countDocuments({
    "images.url": { $regex: "^records/" },
  });

  return { records, refs, bytes, samples, alreadyGcs };
}

async function main() {
  loadEnvLocal({ skipKeys: ["MONGODB_URI"] });
  const { fix, mongodbUri: uriArg } = parseArgs();
  const uri = uriArg?.trim() || process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error(
      "Pasa --mongodb-uri=... o define MONGODB_URI en el entorno del shell."
    );
  }

  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db().collection(COLLECTION);

  console.log(`Mongo: ${maskMongoUri(uri)}`);
  const before = await audit(col);
  await client.close();

  console.log("\n--- Auditoría base64 en Mongo ---");
  console.log(`Registros con base64 pendiente: ${before.records}`);
  console.log(`Referencias data: URL:         ${before.refs}`);
  console.log(`Tamaño estimado en Mongo:     ~${Math.round(before.bytes / 1024 / 1024)} MB`);
  console.log(`Registros ya con clave GCS:   ${before.alreadyGcs}`);
  if (before.samples.length) {
    console.log(`Ejemplos de id pendiente:     ${before.samples.join(", ")}`);
  }

  if (before.refs === 0) {
    console.log("\n✓ No hay base64 en imágenes. Mongo solo debería tener claves records/...");
    return;
  }

  console.log(
    "\nEl script de migración SÍ borra el base64 de Mongo al reemplazar url/processedUrl por claves GCS."
  );
  console.log("Si ves base64, suele ser porque:");
  console.log("  • Solo corriste --dry-run");
  console.log("  • La migración real no terminó");
  console.log("  • Quedaron registros nuevos subidos sin GCS configurado en Railway");

  if (!fix) {
    console.log("\nPara subir a GCS y limpiar Mongo:");
    console.log(
      '  node scripts/migrate-images-to-gcs.mjs --mongodb-uri="..."'
    );
    console.log("O:");
    console.log(
      '  node scripts/audit-mongo-images.mjs --mongodb-uri="..." --fix'
    );
    return;
  }

  console.log("\nEjecutando migración (--fix)...\n");
  const migrate = path.join(ROOT, "scripts", "migrate-images-to-gcs.mjs");
  const result = spawnSync(
    process.execPath,
    [migrate, `--mongodb-uri=${uri}`],
    { stdio: "inherit", env: process.env, cwd: ROOT }
  );
  if (result.status !== 0) process.exit(result.status ?? 1);

  const client2 = new MongoClient(uri);
  await client2.connect();
  const after = await audit(client2.db().collection(COLLECTION));
  await client2.close();

  console.log("\n--- Tras limpieza ---");
  console.log(`Referencias base64 restantes: ${after.refs}`);
  if (after.refs === 0) {
    console.log("✓ Mongo limpio: imágenes solo como claves GCS.");
  } else {
    console.log("⚠ Aún queda base64. Revisa errores arriba o registros concretos.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

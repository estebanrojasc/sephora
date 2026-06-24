#!/usr/bin/env node
/* eslint-disable */
// @ts-nocheck
/**
 * Script de migración: .cache/mock-db.json → MongoDB.
 *
 * Lee los registros del mock JSON usado antes de migrar a Mongo y los
 * inserta en la colección `records`. Si el id ya existe, se hace upsert.
 * Si el registro trae una `extraction` activa, también se guarda una
 * entrada en `extraction_attempts` como activa.
 *
 * Uso:
 *   node scripts/migrate-mock-db.mjs            # migración normal
 *   node scripts/migrate-mock-db.mjs --dry-run  # sólo reporta, no escribe
 *   node scripts/migrate-mock-db.mjs --reset    # elimina docs existentes con esos ids antes de insertar
 *
 * Variables de entorno (se leen de .env.local automáticamente):
 *   MONGODB_URI (default: mongodb://localhost:27017/proyectoisaqwen)
 */

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { MongoClient } from "mongodb";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DEFAULT_URI = "mongodb://localhost:27017/proyectoisaqwen";
const COLLECTIONS = {
  records: "records",
  extractionAttempts: "extraction_attempts",
};

/** Lee variables de .env.local manualmente, sin depender de dotenv. */
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
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}

function getDbName(uri) {
  try {
    const url = new URL(uri);
    const pathname = url.pathname.replace(/^\//, "");
    return pathname || "proyectoisaqwen";
  } catch {
    return "proyectoisaqwen";
  }
}

/** Carga el JSON mock. */
function loadMockRecords() {
  const filePath = path.join(ROOT, ".cache", "mock-db.json");
  if (!fs.existsSync(filePath)) {
    throw new Error(`No existe ${filePath}`);
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  // El archivo es un objeto con keys numéricas: { "0": {...}, "1": {...}, ... }
  // o, eventualmente, ya un array. Soportamos ambos.
  if (Array.isArray(raw)) return raw;
  return Object.values(raw);
}

/**
 * Valida que el registro tenga los campos mínimos. Si falta algo, lo
 * intentamos completar con valores sensatos.
 */
function normalizeRecord(rec) {
  const now = new Date().toISOString();
  const id = rec.id || randomUUID();
  const createdAt = rec.createdAt || now;
  const updatedAt = rec.updatedAt || createdAt;
  const status = rec.status || "uploaded";
  const driverId = rec.driverId || rec.deviceId || randomUUID();
  const driverName = rec.driverName || "Conductor migrado";
  const deviceId = rec.deviceId || driverId;
  const images = Array.isArray(rec.images)
    ? rec.images.map((img) => ({
        id: img.id || randomUUID(),
        url: img.url || "",
        processedUrl: img.processedUrl,
        createdAt: img.createdAt || createdAt,
        processedAt: img.processedAt,
      }))
    : [];

  const normalized = {
    id,
    deviceId,
    driverId,
    driverName,
    status,
    createdAt,
    updatedAt,
    images,
    attemptCount: typeof rec.attemptCount === "number" ? rec.attemptCount : 0,
  };
  if (rec.extraction) normalized.extraction = rec.extraction;
  if (rec.errorComment) normalized.errorComment = rec.errorComment;
  if (rec.previousStatus) normalized.previousStatus = rec.previousStatus;
  if (rec.currentAttemptId) normalized.currentAttemptId = rec.currentAttemptId;
  return normalized;
}

async function main() {
  loadEnvLocal();
  const args = new Set(process.argv.slice(2));
  const isDryRun = args.has("--dry-run");
  const isReset = args.has("--reset");

  const uri = process.env.MONGODB_URI || DEFAULT_URI;
  const dbName = getDbName(uri);

  console.log("──────────────────────────────────────────────");
  console.log("  Migración .cache/mock-db.json → MongoDB");
  console.log("──────────────────────────────────────────────");
  console.log("  URI:        ", uri.replace(/\/\/[^@]+@/, "//***@"));
  console.log("  Base:       ", dbName);
  console.log("  Modo:       ", isDryRun ? "DRY-RUN (no escribe)" : "ESCRITURA");
  console.log("  Reset:      ", isReset ? "sí (borra ids existentes)" : "no");
  console.log("──────────────────────────────────────────────");

  const rawRecords = loadMockRecords();
  console.log(`Encontrados ${rawRecords.length} registros en el mock.`);

  const records = rawRecords.map(normalizeRecord);

  // Resumen rápido por estado.
  const byStatus = records.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});
  console.log("Distribución por estado:", byStatus);

  if (isDryRun) {
    console.log("✓ DRY-RUN listo. No se modificó nada.");
    return;
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  console.log("✓ Conectado a Mongo.");
  try {
    const db = client.db(dbName);
    const recordsCol = db.collection(COLLECTIONS.records);
    const attemptsCol = db.collection(COLLECTIONS.extractionAttempts);

    await recordsCol.createIndex({ id: 1 }, { unique: true });
    await recordsCol.createIndex({ deviceId: 1, createdAt: -1 });
    await recordsCol.createIndex({ status: 1, createdAt: -1 });
    await attemptsCol.createIndex({ recordId: 1, createdAt: -1 });
    await attemptsCol.createIndex({ recordId: 1, isActive: 1 });

    const ids = records.map((r) => r.id);
    if (isReset && ids.length > 0) {
      const del1 = await recordsCol.deleteMany({ id: { $in: ids } });
      const del2 = await attemptsCol.deleteMany({ recordId: { $in: ids } });
      console.log(
        `Reset: borrados ${del1.deletedCount} registros y ${del2.deletedCount} intentos previos.`
      );
    }

    let inserted = 0;
    let updated = 0;
    let attemptsInserted = 0;

    for (const rec of records) {
      // Upsert por `id` para no duplicar.
      const result = await recordsCol.updateOne(
        { id: rec.id },
        { $set: rec },
        { upsert: true }
      );
      if (result.upsertedCount > 0) inserted++;
      else if (result.modifiedCount > 0) updated++;

      // Si trae extracción, registramos también el attempt como activo.
      if (rec.extraction) {
        const existingAttempt = rec.currentAttemptId
          ? await attemptsCol.findOne({
              recordId: rec.id,
              id: rec.currentAttemptId,
            })
          : null;

        if (!existingAttempt) {
          const attemptId = rec.currentAttemptId || randomUUID();
          // Desactivar intentos previos del mismo registro, por si acaso.
          await attemptsCol.updateMany(
            { recordId: rec.id, isActive: true },
            { $set: { isActive: false } }
          );
          await attemptsCol.insertOne({
            id: attemptId,
            recordId: rec.id,
            isActive: true,
            extraction: rec.extraction,
            provider: "mock",
            withBboxes: false,
            imageIds: rec.images.map((img) => img.id),
            createdAt: rec.updatedAt || rec.createdAt,
          });
          // Si el record no tenía currentAttemptId, lo asignamos.
          if (!rec.currentAttemptId) {
            await recordsCol.updateOne(
              { id: rec.id },
              {
                $set: {
                  currentAttemptId: attemptId,
                  attemptCount: rec.attemptCount || 1,
                },
              }
            );
          }
          attemptsInserted++;
        }
      }
    }

    console.log("──────────────────────────────────────────────");
    console.log(`✓ Registros nuevos (upsert): ${inserted}`);
    console.log(`✓ Registros actualizados:    ${updated}`);
    console.log(`✓ Intentos guardados:        ${attemptsInserted}`);
    console.log("──────────────────────────────────────────────");
    console.log("Migración completa.");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("✗ Error en la migración:", err);
  process.exit(1);
});

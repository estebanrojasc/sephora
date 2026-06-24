#!/usr/bin/env node
/* eslint-disable */
// @ts-nocheck
/**
 * Script complementario a migrate-mock-db.mjs.
 *
 * Borra de MongoDB EXACTAMENTE los registros (y sus extraction_attempts)
 * cuyos `id` aparecen en `.cache/mock-db.json`. Cualquier otro registro real
 * subido por un conductor NO se toca.
 *
 * Uso:
 *   node scripts/delete-mock-db.mjs            # borrado real
 *   node scripts/delete-mock-db.mjs --dry-run  # solo reporta, no escribe
 *
 * Variables de entorno (se leen de .env.local automáticamente):
 *   MONGODB_URI (default: mongodb://localhost:27017/proyectoisaqwen)
 */

import fs from "node:fs";
import path from "node:path";
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

function loadMockRecords() {
  const filePath = path.join(ROOT, ".cache", "mock-db.json");
  if (!fs.existsSync(filePath)) {
    throw new Error(`No existe ${filePath}`);
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (Array.isArray(raw)) return raw;
  return Object.values(raw);
}

async function main() {
  loadEnvLocal();
  const args = new Set(process.argv.slice(2));
  const isDryRun = args.has("--dry-run");

  const uri = process.env.MONGODB_URI || DEFAULT_URI;
  const dbName = getDbName(uri);

  console.log("──────────────────────────────────────────────");
  console.log("  Borrado de datos mock en MongoDB");
  console.log("──────────────────────────────────────────────");
  console.log("  URI:        ", uri.replace(/\/\/[^@]+@/, "//***@"));
  console.log("  Base:       ", dbName);
  console.log("  Modo:       ", isDryRun ? "DRY-RUN (no borra)" : "BORRADO REAL");
  console.log("──────────────────────────────────────────────");

  const rawRecords = loadMockRecords();
  const ids = rawRecords.map((r) => r.id).filter(Boolean);
  console.log(
    `Encontrados ${rawRecords.length} registros mock; ${ids.length} con id válido.`
  );
  if (ids.length === 0) {
    console.log("No hay ids para borrar. Saliendo.");
    return;
  }

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  await client.connect();
  console.log("✓ Conectado a Mongo.");
  try {
    const db = client.db(dbName);
    const recordsCol = db.collection(COLLECTIONS.records);
    const attemptsCol = db.collection(COLLECTIONS.extractionAttempts);

    const matchingRecords = await recordsCol.countDocuments({
      id: { $in: ids },
    });
    const matchingAttempts = await attemptsCol.countDocuments({
      recordId: { $in: ids },
    });

    console.log(`  Registros mock presentes en BD:        ${matchingRecords}`);
    console.log(`  extraction_attempts asociados:         ${matchingAttempts}`);

    if (isDryRun) {
      console.log("✓ DRY-RUN listo. No se borró nada.");
      return;
    }

    const delAttempts = await attemptsCol.deleteMany({
      recordId: { $in: ids },
    });
    const delRecords = await recordsCol.deleteMany({ id: { $in: ids } });

    console.log("──────────────────────────────────────────────");
    console.log(`✓ Registros borrados:           ${delRecords.deletedCount}`);
    console.log(`✓ extraction_attempts borrados: ${delAttempts.deletedCount}`);
    console.log("──────────────────────────────────────────────");
    console.log("Listo. Solo se eliminaron los datos del mock.");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("✗ Error en el borrado:", err);
  process.exit(1);
});

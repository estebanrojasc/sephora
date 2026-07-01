import "server-only";
import { randomUUID } from "node:crypto";
import { COLLECTIONS, collectionWithIndexes } from "@/lib/mongo";
import type { ExtractionAttempt } from "@/features/extraction-attempts/types";

async function col() {
  return collectionWithIndexes<ExtractionAttempt>(
    COLLECTIONS.extractionAttempts,
    [
      { key: { id: 1 }, unique: true },
      { key: { recordId: 1, createdAt: -1 } },
      { key: { recordId: 1, isActive: 1 } },
    ]
  );
}

function strip<T extends { _id?: unknown }>(doc: T | null): T | null {
  if (!doc) return null;
  const { _id: _ignored, ...rest } = doc;
  void _ignored;
  return rest as T;
}

/**
 * Crea un nuevo attempt y desactiva los anteriores del mismo registro.
 * El registro completo se mantiene en el historial; solo se cambia `isActive`.
 */
export async function recordAttempt(
  input: Omit<ExtractionAttempt, "id" | "isActive" | "createdAt"> & {
    id?: string;
  }
): Promise<ExtractionAttempt> {
  const c = await col();
  await c.updateMany(
    { recordId: input.recordId, isActive: true },
    { $set: { isActive: false } }
  );
  const attempt: ExtractionAttempt = {
    ...input,
    id: input.id ?? randomUUID(),
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  await c.insertOne(attempt);
  return attempt;
}

export async function listAttempts(
  recordId: string
): Promise<ExtractionAttempt[]> {
  const docs = await (await col())
    .find({ recordId }, { sort: { createdAt: -1 } })
    .toArray();
  return docs.map((d) => strip(d) as ExtractionAttempt);
}

export async function findActiveAttempt(
  recordId: string
): Promise<ExtractionAttempt | null> {
  return strip(
    await (await col()).findOne({ recordId, isActive: true })
  );
}

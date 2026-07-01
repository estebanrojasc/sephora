import "server-only";
import { randomUUID } from "node:crypto";
import { COLLECTIONS, collectionWithIndexes } from "@/lib/mongo";
import type {
  Bitacora,
  BitacoraRow,
  CreateBitacoraPayload,
} from "@/features/bitacora/types";
import type { BitacoraRowPatch } from "@/features/bitacora/row-patch";
import {
  PENDING_DELIVERY_EDITABLE_FIELDS,
} from "@/features/bitacora/row-patch";

async function col() {
  return collectionWithIndexes<Bitacora>(COLLECTIONS.bitacoras, [
    { key: { id: 1 }, unique: true },
    { key: { date: 1, isActive: 1 } },
    { key: { date: 1, version: -1 } },
  ]);
}

function strip<T extends { _id?: unknown }>(doc: T | null): T | null {
  if (!doc) return null;
  const { _id: _ignored, ...rest } = doc;
  void _ignored;
  return rest as T;
}

export async function listBitacoras(filters?: {
  date?: string;
  activeOnly?: boolean;
}): Promise<Bitacora[]> {
  const query: { date?: string; isActive?: boolean } = {};
  if (filters?.date) query.date = filters.date;
  if (filters?.activeOnly) query.isActive = true;

  const docs = await (await col())
    .find(query, { sort: { date: -1, version: -1 } })
    .toArray();
  return docs.map((d) => strip(d) as Bitacora);
}

export async function findBitacoraById(id: string): Promise<Bitacora | null> {
  return strip(await (await col()).findOne({ id }));
}

export async function findActiveBitacoraForDate(
  date: string
): Promise<Bitacora | null> {
  return strip(
    await (await col()).findOne({ date, isActive: true }, { sort: { version: -1 } })
  );
}

export async function listVersionsForDate(date: string): Promise<Bitacora[]> {
  const docs = await (await col())
    .find({ date }, { sort: { version: -1 } })
    .toArray();
  return docs.map((d) => strip(d) as Bitacora);
}

export async function getNextVersionForDate(date: string): Promise<number> {
  const latest = await (await col()).findOne(
    { date },
    { sort: { version: -1 }, projection: { version: 1 } }
  );
  return (latest?.version ?? 0) + 1;
}

export async function createBitacoraVersion(
  payload: CreateBitacoraPayload
): Promise<Bitacora> {
  const c = await col();
  const now = new Date().toISOString();
  const version = await getNextVersionForDate(payload.date);

  await c.updateMany(
    { date: payload.date, isActive: true },
    { $set: { isActive: false, updatedAt: now } }
  );

  const doc: Bitacora = {
    id: randomUUID(),
    date: payload.date,
    title: payload.title,
    version,
    isActive: true,
    rows: payload.rows,
    rawPaste: payload.rawPaste,
    aiProvider: payload.aiProvider,
    createdAt: now,
    updatedAt: now,
  };

  await c.insertOne(doc);
  return doc;
}

export async function appendBitacoraRowRecordLink(
  bitacoraId: string,
  rowId: string,
  recordId: string
): Promise<Bitacora | null> {
  const c = await col();
  const bitacora = await findBitacoraById(bitacoraId);
  if (!bitacora) return null;

  const rows: BitacoraRow[] = bitacora.rows.map((row) => {
    if (row.id !== rowId) return row;
    const existing = new Set<string>();
    if (row.linkedRecordId) existing.add(row.linkedRecordId);
    for (const id of row.linkedRecordIds ?? []) existing.add(id);
    existing.add(recordId);
    const linkedRecordIds = [...existing];
    return {
      ...row,
      linkedRecordId: linkedRecordIds[0],
      linkedRecordIds,
    };
  });

  const updated = await c.findOneAndUpdate(
    { id: bitacoraId },
    { $set: { rows, updatedAt: new Date().toISOString() } },
    { returnDocument: "after" }
  );
  return strip(updated);
}

/** @deprecated Usar appendBitacoraRowRecordLink */
export async function updateBitacoraRowLink(
  bitacoraId: string,
  rowId: string,
  linkedRecordId: string
): Promise<Bitacora | null> {
  return appendBitacoraRowRecordLink(bitacoraId, rowId, linkedRecordId);
}

export async function updateBitacoraRow(
  bitacoraId: string,
  rowId: string,
  patch: BitacoraRowPatch
): Promise<Bitacora | null> {
  const c = await col();
  const bitacora = await findBitacoraById(bitacoraId);
  if (!bitacora) return null;

  const row = bitacora.rows.find((r) => r.id === rowId);
  if (!row) return null;

  const allowed: Partial<BitacoraRow> = {};
  if (patch.allowsMultipleReviews !== undefined) {
    allowed.allowsMultipleReviews = patch.allowsMultipleReviews;
  }
  if (row.rowType === "entrega_pendiente") {
    for (const key of PENDING_DELIVERY_EDITABLE_FIELDS) {
      if (key in patch) {
        const value = patch[key];
        (allowed as Record<string, string | undefined>)[key] =
          value?.trim() ? value.trim() : undefined;
      }
    }
  }

  if (Object.keys(allowed).length === 0) return bitacora;

  const rows: BitacoraRow[] = bitacora.rows.map((r) =>
    r.id === rowId ? { ...r, ...allowed } : r
  );

  const updated = await c.findOneAndUpdate(
    { id: bitacoraId },
    { $set: { rows, updatedAt: new Date().toISOString() } },
    { returnDocument: "after" }
  );
  return strip(updated);
}

export async function updateBitacoraRowSettings(
  bitacoraId: string,
  rowId: string,
  settings: { allowsMultipleReviews?: boolean }
): Promise<Bitacora | null> {
  return updateBitacoraRow(bitacoraId, rowId, settings);
}

export async function listDistinctBitacoraDates(): Promise<string[]> {
  const dates = await (await col()).distinct("date");
  return (dates as string[]).sort((a, b) => b.localeCompare(a));
}

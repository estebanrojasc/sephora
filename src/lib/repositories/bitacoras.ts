import "server-only";
import { randomUUID } from "node:crypto";
import { COLLECTIONS, collectionWithIndexes } from "@/lib/mongo";
import type {
  Bitacora,
  BitacoraRow,
  CreateBitacoraPayload,
} from "@/features/bitacora/types";
import type { BitacoraRowPatch } from "@/features/bitacora/row-patch";
import { BITACORA_ROW_EDITABLE_FIELDS } from "@/features/bitacora/row-patch";
import { inheritBitacoraRowLinks } from "@/features/bitacora/inherit-links";
import {
  collectLinkedRecordIdsForBitacora,
  collectLinkedRecordIdsForDate,
} from "@/features/bitacora/linked-records";
import { getRowLinkedRecordIds } from "@/features/bitacora/row-links";
import {
  findRecordsByBitacoraId,
  findRecordsByIds,
  retargetRecordBitacoraMeta,
} from "@/lib/repositories/records";

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

const BITACORA_LIST_PROJECTION = { rawPaste: 0 } as const;

export async function listBitacoras(filters?: {
  date?: string;
  activeOnly?: boolean;
}): Promise<Bitacora[]> {
  const query: { date?: string; isActive?: boolean } = {};
  if (filters?.date) query.date = filters.date;
  if (filters?.activeOnly) query.isActive = true;

  const docs = await (await col())
    .find(query, {
      sort: { date: -1, version: -1 },
      projection: BITACORA_LIST_PROJECTION,
    })
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
  const previous = await findActiveBitacoraForDate(payload.date);
  const version = await getNextVersionForDate(payload.date);

  let rows = payload.rows;
  let inheritedRecordIds = new Map<string, string[]>();
  if (previous) {
    const inherited = inheritBitacoraRowLinks(previous, payload.rows);
    rows = inherited.rows;
    inheritedRecordIds = inherited.inheritedRecordIds;
  }

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
    rows,
    rawPaste: payload.rawPaste,
    aiProvider: payload.aiProvider,
    createdAt: now,
    updatedAt: now,
  };

  await c.insertOne(doc);

  for (const [rowId, recordIds] of inheritedRecordIds) {
    for (const recordId of recordIds) {
      await retargetRecordBitacoraMeta(recordId, {
        bitacoraId: doc.id,
        rowId,
        version: doc.version,
      });
    }
  }

  return doc;
}

export async function replaceActiveBitacoraContents(
  bitacoraId: string,
  payload: {
    title?: string;
    rows: BitacoraRow[];
    rawPaste: string;
  }
): Promise<Bitacora | null> {
  const c = await col();
  const bitacora = await findBitacoraById(bitacoraId);
  if (!bitacora || !bitacora.isActive) return null;

  const updated = await c.findOneAndUpdate(
    { id: bitacoraId, isActive: true },
    {
      $set: {
        title: payload.title,
        rows: payload.rows,
        rawPaste: payload.rawPaste,
        updatedAt: new Date().toISOString(),
      },
    },
    { returnDocument: "after" }
  );
  return strip(updated);
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

/** Quita un recordId de linkedRecordIds / linkedRecordId de una fila. */
export async function removeBitacoraRowRecordLink(
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
    existing.delete(recordId);
    const linkedRecordIds = [...existing];
    return {
      ...row,
      linkedRecordId: linkedRecordIds[0],
      linkedRecordIds: linkedRecordIds.length > 0 ? linkedRecordIds : undefined,
    };
  });

  const updated = await c.findOneAndUpdate(
    { id: bitacoraId },
    { $set: { rows, updatedAt: new Date().toISOString() } },
    { returnDocument: "after" }
  );
  return strip(updated);
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
  for (const key of BITACORA_ROW_EDITABLE_FIELDS) {
    if (key in patch) {
      const value = patch[key];
      if (key === "rowType" && typeof value === "string") {
        allowed.rowType = value as BitacoraRow["rowType"];
      } else if (typeof value === "string" || value === undefined) {
        (allowed as Record<string, string | undefined>)[key] =
          typeof value === "string" && value.trim() ? value.trim() : undefined;
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

export class BitacoraDeleteBlockedError extends Error {
  constructor(
    message: string,
    public readonly blockingRecordIds: string[] = []
  ) {
    super(message);
    this.name = "BitacoraDeleteBlockedError";
  }
}

export async function deleteBitacoraRow(
  bitacoraId: string,
  rowId: string
): Promise<Bitacora | null> {
  const c = await col();
  const bitacora = await findBitacoraById(bitacoraId);
  if (!bitacora) return null;
  if (!bitacora.isActive) {
    throw new BitacoraDeleteBlockedError(
      "Solo se pueden eliminar filas de la versión activa"
    );
  }

  const row = bitacora.rows.find((r) => r.id === rowId);
  if (!row) return null;

  const linkIds = new Set(getRowLinkedRecordIds(row));
  for (const rec of await findRecordsByBitacoraId(bitacoraId)) {
    if (rec.extraction?._meta?.bitacora?.rowId === rowId) {
      linkIds.add(rec.id);
    }
  }
  const records = await findRecordsByIds([...linkIds]);
  if (records.length > 0) {
    throw new BitacoraDeleteBlockedError(
      "La fila tiene registros vinculados. Desvincúlalos o elimínalos desde la cola primero.",
      records.map((r) => r.id)
    );
  }

  const rows = bitacora.rows.filter((r) => r.id !== rowId);
  const updated = await c.findOneAndUpdate(
    { id: bitacoraId },
    { $set: { rows, updatedAt: new Date().toISOString() } },
    { returnDocument: "after" }
  );
  return strip(updated);
}

export async function deleteBitacoraVersion(
  bitacoraId: string
): Promise<{ deleted: Bitacora; reactivatedId: string | null }> {
  const c = await col();
  const bitacora = await findBitacoraById(bitacoraId);
  if (!bitacora) {
    throw new BitacoraDeleteBlockedError("Bitácora no encontrada");
  }

  const linkedIds = await collectLinkedRecordIdsForBitacora(bitacora);
  if (linkedIds.length > 0) {
    throw new BitacoraDeleteBlockedError(
      "Hay registros vinculados. Elimínalos o desvincúlalos desde cada registro antes de borrar esta versión.",
      linkedIds
    );
  }

  await c.deleteOne({ id: bitacoraId });

  let reactivatedId: string | null = null;
  if (bitacora.isActive) {
    const previous = await c.findOne(
      { date: bitacora.date, id: { $ne: bitacoraId } },
      { sort: { version: -1 } }
    );
    if (previous) {
      const now = new Date().toISOString();
      await c.updateOne(
        { id: previous.id },
        { $set: { isActive: true, updatedAt: now } }
      );
      reactivatedId = previous.id;
    }
  }

  return { deleted: bitacora, reactivatedId };
}

export async function deleteBitacorasForDate(
  date: string
): Promise<{ deletedCount: number }> {
  const versions = await listVersionsForDate(date);
  if (versions.length === 0) {
    return { deletedCount: 0 };
  }

  const linkedIds = await collectLinkedRecordIdsForDate(versions);
  if (linkedIds.length > 0) {
    throw new BitacoraDeleteBlockedError(
      "Hay registros vinculados a este día. Elimínalos o desvincúlalos desde cada registro antes de borrar la bitácora.",
      linkedIds
    );
  }

  const c = await col();
  const result = await c.deleteMany({ date });
  return { deletedCount: result.deletedCount };
}

export async function listDistinctBitacoraDates(): Promise<string[]> {
  const dates = await (await col()).distinct("date");
  return (dates as string[]).sort((a, b) => b.localeCompare(a));
}

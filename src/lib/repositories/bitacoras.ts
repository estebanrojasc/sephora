import "server-only";
import { randomUUID } from "node:crypto";
import { getDb, COLLECTIONS } from "@/lib/mongo";
import type {
  Bitacora,
  BitacoraRow,
  CreateBitacoraPayload,
} from "@/features/bitacora/types";

async function col() {
  const db = await getDb();
  const c = db.collection<Bitacora>(COLLECTIONS.bitacoras);
  await c.createIndex({ id: 1 }, { unique: true });
  await c.createIndex({ date: 1, isActive: 1 });
  await c.createIndex({ date: 1, version: -1 });
  return c;
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

export async function updateBitacoraRowLink(
  bitacoraId: string,
  rowId: string,
  linkedRecordId: string
): Promise<Bitacora | null> {
  const c = await col();
  const bitacora = await findBitacoraById(bitacoraId);
  if (!bitacora) return null;

  const rows: BitacoraRow[] = bitacora.rows.map((row) =>
    row.id === rowId ? { ...row, linkedRecordId } : row
  );

  const updated = await c.findOneAndUpdate(
    { id: bitacoraId },
    { $set: { rows, updatedAt: new Date().toISOString() } },
    { returnDocument: "after" }
  );
  return strip(updated);
}

export async function listDistinctBitacoraDates(): Promise<string[]> {
  const dates = await (await col()).distinct("date");
  return (dates as string[]).sort((a, b) => b.localeCompare(a));
}

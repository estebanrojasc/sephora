import "server-only";
import { randomUUID } from "node:crypto";
import { COLLECTIONS, collectionWithIndexes } from "@/lib/mongo";
import type {
  Catalog,
  CreateCatalogPayload,
  UpdateCatalogPayload,
} from "@/features/catalogs/types";
import { DEFAULT_CATALOGS } from "@/features/catalogs/defaults";

async function col() {
  return collectionWithIndexes<Catalog>(COLLECTIONS.catalogs, [
    { key: { id: 1 }, unique: true },
    { key: { fieldKey: 1, active: 1 } },
  ]);
}

function strip<T extends { _id?: unknown }>(doc: T | null): T | null {
  if (!doc) return null;
  const { _id: _ignored, ...rest } = doc;
  void _ignored;
  return rest as T;
}

export async function listCatalogs(): Promise<Catalog[]> {
  await ensureDefaultCatalogs();
  const docs = await (await col()).find({}, { sort: { name: 1 } }).toArray();
  return docs.map((d) => strip(d) as Catalog);
}

export async function listActiveCatalogs(): Promise<Catalog[]> {
  await ensureDefaultCatalogs();
  const docs = await (await col())
    .find({ active: true }, { sort: { name: 1 } })
    .toArray();
  return docs.map((d) => strip(d) as Catalog);
}

/** Inserta catálogos base si aún no existen; actualiza ítems por defecto obsoletos. */
export async function ensureDefaultCatalogs(): Promise<void> {
  const c = await col();
  for (const def of DEFAULT_CATALOGS) {
    const exists = await c.findOne({ fieldKey: def.fieldKey });
    if (!exists) {
      await createCatalog(def);
      continue;
    }
    if (
      def.fieldKey === "detalle_transferencias.banco" &&
      def.items &&
      exists.items.every((i) => ["E", "VE", "S"].includes(i.value.trim()))
    ) {
      await updateCatalog(exists.id, { name: def.name, items: def.items });
    }
  }
}

export async function findCatalogById(id: string): Promise<Catalog | null> {
  return strip(await (await col()).findOne({ id }));
}

export async function createCatalog(
  payload: CreateCatalogPayload
): Promise<Catalog> {
  const now = new Date().toISOString();
  const cat: Catalog = {
    id: randomUUID(),
    name: payload.name.trim(),
    fieldKey: payload.fieldKey.trim(),
    active: payload.active ?? true,
    items: payload.items ?? [],
    createdAt: now,
    updatedAt: now,
  };
  await (await col()).insertOne(cat);
  return cat;
}

export async function updateCatalog(
  id: string,
  patch: UpdateCatalogPayload
): Promise<Catalog | null> {
  const updated = await (
    await col()
  ).findOneAndUpdate(
    { id },
    { $set: { ...patch, updatedAt: new Date().toISOString() } },
    { returnDocument: "after" }
  );
  return strip(updated);
}

export async function deleteCatalog(id: string): Promise<boolean> {
  const res = await (await col()).deleteOne({ id });
  return res.deletedCount === 1;
}

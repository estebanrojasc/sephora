import "server-only";
import type { Bitacora } from "@/features/bitacora/types";
import { getRowLinkedRecordIds } from "@/features/bitacora/row-links";
import {
  removeBitacoraRowRecordLink,
} from "@/lib/repositories/bitacoras";
import {
  findRecordById,
  patchRecordExtractionMeta,
} from "@/lib/repositories/records";
import type { Record } from "@/features/records/types";
import { COLLECTIONS, collectionWithIndexes } from "@/lib/mongo";

async function bitacoraCol() {
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

export async function findBitacoraRowLinksForRecord(
  recordId: string
): Promise<{ bitacoraId: string; rowId: string }[]> {
  const docs = await (
    await bitacoraCol()
  )
    .find({
      $or: [
        { "rows.linkedRecordId": recordId },
        { "rows.linkedRecordIds": recordId },
      ],
    })
    .toArray();

  const links: { bitacoraId: string; rowId: string }[] = [];
  for (const doc of docs) {
    const bitacora = strip(doc) as Bitacora;
    for (const row of bitacora.rows) {
      if (getRowLinkedRecordIds(row).includes(recordId)) {
        links.push({ bitacoraId: bitacora.id, rowId: row.id });
      }
    }
  }
  return links;
}

export async function unlinkRecordFromBitacora(
  recordId: string
): Promise<Record | null> {
  const record = await findRecordById(recordId);
  if (!record) return null;

  const rowLinks = await findBitacoraRowLinksForRecord(recordId);
  for (const link of rowLinks) {
    await removeBitacoraRowRecordLink(
      link.bitacoraId,
      link.rowId,
      recordId
    );
  }

  const meta = record.extraction?._meta?.bitacora;
  if (meta?.bitacoraId && meta.rowId) {
    const already = rowLinks.some(
      (l) => l.bitacoraId === meta.bitacoraId && l.rowId === meta.rowId
    );
    if (!already) {
      await removeBitacoraRowRecordLink(
        meta.bitacoraId,
        meta.rowId,
        recordId
      );
    }
  }

  return patchRecordExtractionMeta(recordId);
}

export async function recordIsLinkedToBitacora(
  recordId: string
): Promise<boolean> {
  const record = await findRecordById(recordId);
  if (!record) return false;
  if (record.extraction?._meta?.bitacora?.bitacoraId) return true;
  const rowLinks = await findBitacoraRowLinksForRecord(recordId);
  return rowLinks.length > 0;
}

import "server-only";
import type { Bitacora } from "@/features/bitacora/types";
import { getRowLinkedRecordIds } from "@/features/bitacora/row-links";
import {
  findRecordsByBitacoraId,
  findRecordsByIds,
} from "@/lib/repositories/records";

/** IDs de registros vinculados a una versión de bitácora (filas + meta). */
export async function collectLinkedRecordIdsForBitacora(
  bitacora: Bitacora
): Promise<string[]> {
  const ids = new Set<string>();
  for (const row of bitacora.rows) {
    for (const id of getRowLinkedRecordIds(row)) ids.add(id);
  }
  const byMeta = await findRecordsByBitacoraId(bitacora.id);
  for (const rec of byMeta) ids.add(rec.id);
  const existing = await findRecordsByIds([...ids]);
  return existing.map((r) => r.id);
}

export async function collectLinkedRecordIdsForDate(
  versions: Bitacora[]
): Promise<string[]> {
  const ids = new Set<string>();
  for (const version of versions) {
    for (const id of await collectLinkedRecordIdsForBitacora(version)) {
      ids.add(id);
    }
  }
  return [...ids];
}

import type { Record as AppRecord } from "./types";
import { recordDayKeyIso } from "@/lib/date-utils";
import type { RecordsDayFilterMode } from "@/components/admin/RecordsDayFilter";
import { getRowLinkedRecordIds } from "@/features/bitacora/row-links";
import type { Bitacora } from "@/features/bitacora/types";

/**
 * Filtra por día de carga o de recorrido.
 * Si hay bitácora activa del mismo día, también incluye registros vinculados
 * a esa bitácora aunque su fecha de extracción esté desfasada (así no
 * “desaparecen” de la cola del día operativo).
 */
export function filterRecordsByDay(
  records: AppRecord[],
  dayIso: string,
  mode: RecordsDayFilterMode,
  bitacora?: Bitacora | null
): AppRecord[] {
  const includeBitacoraLinks = Boolean(bitacora && bitacora.date === dayIso);
  const linkedIds = new Set<string>();
  if (includeBitacoraLinks && bitacora) {
    for (const row of bitacora.rows) {
      for (const id of getRowLinkedRecordIds(row)) linkedIds.add(id);
    }
  }

  return records.filter((r) => {
    if (
      recordDayKeyIso(r.createdAt, r.extraction?.fecha?.valor, mode) === dayIso
    ) {
      return true;
    }
    if (!includeBitacoraLinks || !bitacora) return false;
    if (linkedIds.has(r.id)) return true;
    return r.extraction?._meta?.bitacora?.bitacoraId === bitacora.id;
  });
}

export function duplicateRecorridoKeys(records: AppRecord[]): Set<string> {
  const counts = new Map<string, number>();
  for (const r of records) {
    const key = r.extraction?.n_recorrido?.valor?.trim().toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const dupes = new Set<string>();
  for (const [key, count] of counts) {
    if (count > 1) dupes.add(key);
  }
  return dupes;
}

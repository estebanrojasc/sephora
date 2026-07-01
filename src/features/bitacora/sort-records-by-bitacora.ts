import type { Record } from "@/features/records/types";
import type { Bitacora } from "./types";

/** Ordena registros según el orden de filas en la bitácora activa del día. */
export function sortRecordsByBitacora(
  records: Record[],
  bitacora: Bitacora | null | undefined
): Record[] {
  if (!bitacora?.rows?.length) return [...records];

  const rowIndex = new Map<string, number>();
  bitacora.rows.forEach((row, index) => {
    rowIndex.set(row.id, index);
  });

  return [...records].sort((a, b) => {
    const aRowId = a.extraction?._meta?.bitacora?.rowId;
    const bRowId = b.extraction?._meta?.bitacora?.rowId;
    const aIdx = aRowId != null ? rowIndex.get(aRowId) : undefined;
    const bIdx = bRowId != null ? rowIndex.get(bRowId) : undefined;

    if (aIdx != null && bIdx != null) return aIdx - bIdx;
    if (aIdx != null) return -1;
    if (bIdx != null) return 1;

    const aRec = a.extraction?.n_recorrido?.valor?.trim() ?? "";
    const bRec = b.extraction?.n_recorrido?.valor?.trim() ?? "";
    if (aRec && bRec && aRec !== bRec) return aRec.localeCompare(bRec, "es");

    return a.createdAt.localeCompare(b.createdAt);
  });
}

import { bitacoraRecorridoCanonical } from "./meta";
import { getRowLinkedRecordIds } from "./row-links";
import { normalizeRecorridoDigits } from "./normalize-keys";
import type { Bitacora, BitacoraRow } from "./types";

function rowMatchKey(row: BitacoraRow): string | null {
  const digits = normalizeRecorridoDigits(bitacoraRecorridoCanonical(row));
  if (!digits) return null;
  return `${row.rowType}::${digits}`;
}

/**
 * Copia vínculos (y settings útiles) de la versión previa a las filas nuevas
 * emparejando por tipo de fila + recorrido canónico.
 */
export function inheritBitacoraRowLinks(
  previous: Bitacora,
  nextRows: BitacoraRow[]
): { rows: BitacoraRow[]; inheritedRecordIds: Map<string, string[]> } {
  const prevByKey = new Map<string, BitacoraRow>();
  for (const row of previous.rows) {
    const key = rowMatchKey(row);
    if (!key || prevByKey.has(key)) continue;
    prevByKey.set(key, row);
  }

  const inheritedRecordIds = new Map<string, string[]>();
  const usedPrevIds = new Set<string>();

  const rows = nextRows.map((row) => {
    const key = rowMatchKey(row);
    if (!key) return row;
    const prev = prevByKey.get(key);
    if (!prev || usedPrevIds.has(prev.id)) return row;
    usedPrevIds.add(prev.id);

    const linkedRecordIds = getRowLinkedRecordIds(prev);
    if (linkedRecordIds.length === 0 && prev.allowsMultipleReviews === undefined) {
      if (
        row.rowType === "entrega_pendiente" &&
        !row.scheduledDate &&
        prev.scheduledDate
      ) {
        return { ...row, scheduledDate: prev.scheduledDate };
      }
      return row;
    }

    if (linkedRecordIds.length > 0) {
      inheritedRecordIds.set(row.id, linkedRecordIds);
    }

    return {
      ...row,
      linkedRecordId: linkedRecordIds[0],
      linkedRecordIds: linkedRecordIds.length > 0 ? linkedRecordIds : undefined,
      allowsMultipleReviews:
        row.allowsMultipleReviews ?? prev.allowsMultipleReviews,
      scheduledDate:
        row.scheduledDate ||
        (row.rowType === "entrega_pendiente" ? prev.scheduledDate : undefined),
    };
  });

  return { rows, inheritedRecordIds };
}

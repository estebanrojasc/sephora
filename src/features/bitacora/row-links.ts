import { getRecordConductorLabel } from "@/features/records/display";
import type { Record, RecordStatus } from "@/features/records/types";
import type { Bitacora, BitacoraRow } from "./types";

export interface BitacoraRowRecordLink {
  recordId: string;
  label: string;
  status: RecordStatus;
}

export function getRowLinkedRecordIds(row: BitacoraRow): string[] {
  const ids = new Set<string>();
  if (row.linkedRecordId) ids.add(row.linkedRecordId);
  for (const id of row.linkedRecordIds ?? []) {
    if (id) ids.add(id);
  }
  return [...ids];
}

/** Por defecto solo ingresos manuales admiten más de una revisión. */
export function defaultAllowsMultipleReviews(row: BitacoraRow): boolean {
  return row.rowType === "manual";
}

export function rowAllowsMultipleReviews(row: BitacoraRow): boolean {
  if (row.allowsMultipleReviews !== undefined) {
    return row.allowsMultipleReviews;
  }
  return defaultAllowsMultipleReviews(row);
}

export function collectBitacoraRowRecordLinks(
  bitacora: Bitacora,
  records: Record[]
): Map<string, BitacoraRowRecordLink[]> {
  const map = new Map<string, BitacoraRowRecordLink[]>();

  const addLink = (rowId: string, record: Record) => {
    const list = map.get(rowId) ?? [];
    if (list.some((l) => l.recordId === record.id)) return;
    list.push({
      recordId: record.id,
      label: getRecordConductorLabel(record),
      status: record.status,
    });
    map.set(rowId, list);
  };

  for (const row of bitacora.rows) {
    for (const recordId of getRowLinkedRecordIds(row)) {
      const rec = records.find((r) => r.id === recordId);
      if (rec) addLink(row.id, rec);
    }
  }

  for (const record of records) {
    const meta = record.extraction?._meta?.bitacora;
    if (meta?.bitacoraId === bitacora.id && meta.rowId) {
      addLink(meta.rowId, record);
    }
  }

  return map;
}

export function canCreateRecordForBitacoraRow(
  row: BitacoraRow,
  links: BitacoraRowRecordLink[]
): boolean {
  if (row.rowType !== "manual" && row.rowType !== "ruta") return false;
  if (links.length === 0) return true;
  return rowAllowsMultipleReviews(row);
}

/** Filas bloqueadas para otros registros (ya tienen revisión y no admiten más). */
export function blockedBitacoraRowIdsForRecord(
  bitacora: Bitacora,
  records: Record[],
  currentRecordId: string
): Set<string> {
  const links = collectBitacoraRowRecordLinks(bitacora, records);
  const blocked = new Set<string>();

  for (const row of bitacora.rows) {
    if (row.rowType !== "ruta" && row.rowType !== "manual") continue;
    const rowLinks = links.get(row.id) ?? [];
    const otherLinks = rowLinks.filter((l) => l.recordId !== currentRecordId);
    if (otherLinks.length > 0 && !rowAllowsMultipleReviews(row)) {
      blocked.add(row.id);
    }
  }

  return blocked;
}

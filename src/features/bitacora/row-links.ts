import { getRecordConductorLabel } from "@/features/records/display";
import type { Record, RecordStatus } from "@/features/records/types";
import { bitacoraRecorridoCanonical } from "./meta";
import { recorridosAgree } from "./match";
import { normalizeRecorridoDigits } from "./normalize-keys";
import type { Bitacora, BitacoraRow } from "./types";

export interface BitacoraRowRecordLink {
  recordId: string;
  label: string;
  status: RecordStatus;
  /**
   * Vínculo confiable: meta.rowId de este registro apunta a la fila, o el
   * recorrido concuerda. Sin esto, patente+conductor podían marcar «Vinculada»
   * filas que no tienen registro propio en la cola.
   */
  confirmed: boolean;
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

export function isConfirmedBitacoraRowLink(
  record: Record,
  row: BitacoraRow
): boolean {
  if (recorridosAgree(record, row)) return true;

  // Meta apunta aquí pero el recorrido dice otra cosa → vínculo dudoso.
  if (record.extraction?._meta?.bitacora?.rowId === row.id) {
    const recDigits = normalizeRecorridoDigits(
      record.extraction?.n_recorrido?.valor
    );
    const rowDigits = normalizeRecorridoDigits(bitacoraRecorridoCanonical(row));
    // Sin recorrido en alguno de los dos, confiamos en el meta explícito.
    return !recDigits || !rowDigits;
  }

  return false;
}

export function collectBitacoraRowRecordLinks(
  bitacora: Bitacora,
  records: Record[]
): Map<string, BitacoraRowRecordLink[]> {
  const map = new Map<string, BitacoraRowRecordLink[]>();
  const byId = new Map(records.map((r) => [r.id, r]));

  const addLink = (row: BitacoraRow, record: Record) => {
    const list = map.get(row.id) ?? [];
    if (list.some((l) => l.recordId === record.id)) return;
    list.push({
      recordId: record.id,
      label: getRecordConductorLabel(record),
      status: record.status,
      confirmed: isConfirmedBitacoraRowLink(record, row),
    });
    map.set(row.id, list);
  };

  for (const row of bitacora.rows) {
    for (const recordId of getRowLinkedRecordIds(row)) {
      const rec = byId.get(recordId);
      if (rec) addLink(row, rec);
    }
  }

  for (const record of records) {
    const meta = record.extraction?._meta?.bitacora;
    if (meta?.bitacoraId === bitacora.id && meta.rowId) {
      const row = bitacora.rows.find((r) => r.id === meta.rowId);
      if (row) addLink(row, record);
    }
  }

  return map;
}

export function confirmedBitacoraRowLinks(
  links: BitacoraRowRecordLink[]
): BitacoraRowRecordLink[] {
  return links.filter((l) => l.confirmed);
}

export function canCreateRecordForBitacoraRow(
  row: BitacoraRow,
  links: BitacoraRowRecordLink[]
): boolean {
  if (
    row.rowType !== "manual" &&
    row.rowType !== "ruta" &&
    row.rowType !== "entrega_pendiente"
  ) {
    return false;
  }
  const confirmed = confirmedBitacoraRowLinks(links);
  if (confirmed.length === 0) return true;
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
    if (
      row.rowType !== "ruta" &&
      row.rowType !== "manual" &&
      row.rowType !== "entrega_pendiente"
    ) {
      continue;
    }
    const rowLinks = links.get(row.id) ?? [];
    const otherConfirmed = confirmedBitacoraRowLinks(rowLinks).filter(
      (l) => l.recordId !== currentRecordId
    );
    if (otherConfirmed.length > 0 && !rowAllowsMultipleReviews(row)) {
      blocked.add(row.id);
    }
  }

  return blocked;
}

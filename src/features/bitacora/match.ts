import type { Record } from "@/features/records/types";
import { parseNumber } from "@/lib/parse-number";
import { recordDayKeyIso } from "@/lib/date-utils";
import { BITACORA_MATCH_THRESHOLD } from "./config";
import {
  namesMatch,
  normalizePatente,
  normalizeRecorridoDigits,
  recorridoSuffix,
} from "./normalize-keys";
import {
  rowToExcelFields,
  bitacoraRecorridoCanonical,
  bitacoraRecorridoOcrHint,
} from "./meta";
import type {
  Bitacora,
  BitacoraMatch,
  BitacoraRow,
  BitacoraSuggestedFields,
} from "./types";

function scoreRow(
  record: Record,
  row: BitacoraRow
): number {
  const ex = record.extraction;
  if (!ex) return 0;

  let score = 0;

  const recDigits = normalizeRecorridoDigits(ex.n_recorrido?.valor);
  const rowSuffix = row.recorridoSuffix ?? recorridoSuffix(row.recorrido);
  if (recDigits && rowSuffix) {
    if (recDigits.endsWith(rowSuffix) || recDigits === rowSuffix) score += 40;
    else if (row.recorrido && recDigits === normalizeRecorridoDigits(row.recorrido))
      score += 40;
  }

  const patRec = normalizePatente(ex.patente?.valor);
  const patRow = normalizePatente(row.patente);
  if (patRec && patRow && patRec === patRow) score += 25;

  if (namesMatch(ex.conductor?.valor, row.conductor)) score += 15;
  if (namesMatch(ex.auxiliar?.valor, row.auxiliar)) score += 10;

  const cantRec = parseNumber(ex.cant_fact?.valor);
  const cantRow = parseNumber(row.cantFact);
  if (cantRec != null && cantRow != null && cantRec === cantRow) score += 5;

  const valRec = parseNumber(ex.valor_total?.valor);
  const valRow = parseNumber(row.montoTotal);
  if (valRec != null && valRow != null && Math.abs(valRec - valRow) < 1)
    score += 5;

  return score;
}

export function scoreBitacoraRow(record: Record, row: BitacoraRow): number {
  return scoreRow(record, row);
}

export function listAssignableBitacoraRows(bitacora: Bitacora): BitacoraRow[] {
  return bitacora.rows.filter(
    (r) => r.rowType === "ruta" || r.rowType === "manual"
  );
}

/** Filas elegibles en el selector, excluyendo las ya vinculadas a otros registros. */
export function listAvailableBitacoraRows(
  bitacora: Bitacora,
  options: {
    currentRecordId: string;
    currentRowId?: string | null;
    /** Filas con revisión ajena que no admiten más de una. */
    blockedRowIds?: ReadonlySet<string>;
  }
): BitacoraRow[] {
  const { currentRecordId, currentRowId, blockedRowIds } = options;
  return listAssignableBitacoraRows(bitacora).filter((row) => {
    if (currentRowId && row.id === currentRowId) return true;
    if (blockedRowIds?.has(row.id)) return false;
    return true;
  });
}

export function formatBitacoraRowLabel(row: BitacoraRow): string {
  const recorrido = bitacoraRecorridoCanonical(row);
  const parts = [
    recorrido ? `Rec. ${recorrido}` : undefined,
    row.conductor,
    row.patente,
    row.sector,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(" · ");
  if (row.primerFolio) return `Folio ${row.primerFolio}`;
  if (row.manualSubtype) return row.manualSubtype.replace(/_/g, " ");
  if (row.territorio || row.anden) {
    return [row.territorio, row.anden].filter(Boolean).join(" · ");
  }
  return "Fila sin datos";
}

export function rowToSuggested(row: BitacoraRow): BitacoraSuggestedFields {
  const excel = rowToExcelFields(row);
  return {
    patente: excel.patente,
    conductor: excel.conductor,
    auxiliar: excel.auxiliar,
    n_recorrido: excel.recorrido,
    recorrido: excel.recorrido,
    cant_fact: excel.n_factura,
    n_factura: excel.n_factura,
    valor_total: excel.total_factura,
    total_factura: excel.total_factura,
    sector: excel.sector,
    observaciones: excel.observaciones,
  };
}

/** Pistas al OCR: recorrido parcial como en la hoja impresa, resto igual que suggested. */
export function rowToOcrHint(row: BitacoraRow): BitacoraSuggestedFields {
  const suggested = rowToSuggested(row);
  const partial = bitacoraRecorridoOcrHint(row);
  return {
    ...suggested,
    n_recorrido: partial,
    recorrido: partial,
  };
}

export function matchRecordToBitacora(
  record: Record,
  bitacora: Bitacora
): BitacoraMatch | null {
  const candidates = bitacora.rows.filter(
    (r) => r.rowType === "ruta" || r.rowType === "manual"
  );
  if (candidates.length === 0) return null;

  let best: { row: BitacoraRow; score: number } | null = null;
  for (const row of candidates) {
    const score = scoreRow(record, row);
    if (!best || score > best.score) {
      best = { row, score };
    }
  }

  if (!best || best.score < BITACORA_MATCH_THRESHOLD) return null;

  return {
    bitacoraId: bitacora.id,
    rowId: best.row.id,
    version: bitacora.version,
    matchScore: best.score,
    suggested: rowToSuggested(best.row),
    row: best.row,
  };
}

export function getRecordDayForBitacora(record: Record): string {
  return recordDayKeyIso(
    record.createdAt,
    record.extraction?.fecha?.valor,
    "fecha"
  );
}

export function matchScoreForRecord(
  record: Record,
  bitacora: Bitacora | null | undefined
): number {
  if (!bitacora) return 0;
  const match = matchRecordToBitacora(record, bitacora);
  return match?.matchScore ?? 0;
}

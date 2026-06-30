import { parseToIso, todayIsoDateChile } from "@/lib/date-utils";
import type { Extraction } from "@/features/records/types";
import type { ChequeRow } from "@/features/records/types";

/**
 * Fecha de referencia para clasificar cheques: la del documento (rendición),
 * no el calendario de hoy. Si falta, usa hoy en Chile.
 */
export function chequeReferenceIso(extraction?: Extraction | null): string {
  const fromDoc = parseToIso(extraction?.fecha?.valor);
  if (fromDoc) return fromDoc;
  return todayIsoDateChile();
}

/** Requiere fecha interpretable con día, mes y año (no solo el número del día). */
function hasFullChequeDate(fechaValor: string): boolean {
  const v = fechaValor.trim();
  if (!v) return false;
  if (/^\d{1,2}$/.test(v)) return false;
  const iso = parseToIso(v);
  if (!iso) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso);
}

/**
 * Cheque al día: fecha completa del cheque es la misma que la del documento
 * o anterior (mismo día de ruta o vencido). Comparación YYYY-MM-DD estricta.
 */
export function isChequeAlDia(
  fechaValor: string,
  referenceIso?: string
): boolean {
  if (!hasFullChequeDate(fechaValor)) return false;
  const iso = parseToIso(fechaValor);
  const ref = referenceIso ?? todayIsoDateChile();
  if (!iso || !ref) return false;
  return iso <= ref;
}

export function splitChequesByTipo(
  cheques: ChequeRow[],
  referenceIso?: string
): { alDia: ChequeRow[]; aFecha: ChequeRow[] } {
  const ref = referenceIso ?? todayIsoDateChile();
  const alDia: ChequeRow[] = [];
  const aFecha: ChequeRow[] = [];
  for (const row of cheques) {
    if (isChequeAlDia(row.fecha.valor, ref)) {
      alDia.push(row);
    } else {
      aFecha.push(row);
    }
  }
  return { alDia, aFecha };
}

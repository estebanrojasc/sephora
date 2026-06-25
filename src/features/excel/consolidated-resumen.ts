import {
  createEmptyExtraction,
  ensureExtractionShape,
  type Extraction,
  type Record as AppRecord,
} from "@/features/records/types";
import { migrateLegacyTransfers } from "@/features/pdf/reporte-utils";

export interface SummaryField {
  label: string;
  pick: (e: Extraction) => string;
  numeric?: boolean;
  sum?: boolean;
}

/** Campos del resumen consolidado (columna A = etiqueta, B+ = un registro por columna). */
export const SUMMARY_FIELDS: SummaryField[] = [
  { label: "FECHA", pick: (e) => e.fecha.valor },
  { label: "CHOFER", pick: (e) => e.conductor.valor },
  { label: "AUXILIAR / PEONETA", pick: (e) => e.auxiliar.valor },
  { label: "RECORRIDO", pick: (e) => e.n_recorrido.valor },
  { label: "PATENTE", pick: (e) => e.patente.valor },
  {
    label: "N° FACT.",
    pick: (e) => e.cant_fact.valor,
    numeric: true,
    sum: true,
  },
  {
    label: "TOTAL FACT.",
    pick: (e) => e.valor_total.valor,
    numeric: true,
    sum: true,
  },
  {
    label: "EFECTIVO TOTAL",
    pick: (e) => e.rendicion.efectivo_total.valor,
    numeric: true,
    sum: true,
  },
  {
    label: "BILLETES",
    pick: (e) => e.detalle_efectivo.total_billetes.valor,
    numeric: true,
    sum: true,
  },
  {
    label: "MONEDAS",
    pick: (e) => e.detalle_efectivo.total_monedas.valor,
    numeric: true,
    sum: true,
  },
  {
    label: "CHEQUES AL DÍA",
    pick: (e) => e.rendicion.cheques_al_dia.valor,
    numeric: true,
    sum: true,
  },
  {
    label: "CHEQUES A FECHA",
    pick: (e) => e.rendicion.cheques_a_fecha.valor,
    numeric: true,
    sum: true,
  },
  {
    label: "CRÉDITO VENDEDOR",
    pick: (e) => e.rendicion.credito_vendedor.valor,
    numeric: true,
    sum: true,
  },
  {
    label: "NULOS (RETORNO TOTAL)",
    pick: (e) => e.rendicion.retorno_total.valor,
    numeric: true,
    sum: true,
  },
  {
    label: "PARCIALES (RETORNO PARCIAL)",
    pick: (e) => e.rendicion.retorno_parcial.valor,
    numeric: true,
    sum: true,
  },
  {
    label: "N/C NEGOCIO",
    pick: (e) => e.rendicion.n_c_negocio.valor,
    numeric: true,
    sum: true,
  },
  {
    label: "TRANSFERENCIAS",
    pick: (e) => e.rendicion.transferencia.valor,
    numeric: true,
    sum: true,
  },
  {
    label: "TOTAL RENDICIÓN",
    pick: (e) => e.rendicion.total.valor,
    numeric: true,
    sum: true,
  },
];

export function excelColumn(index: number): string {
  let n = index;
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/** Columna B = índice 1; registro i va en columna B+i. */
export function summaryColumnForRecord(recordIndex: number): string {
  return excelColumn(1 + recordIndex);
}

export function recordLabel(record: AppRecord): string {
  const rec = record.extraction?.n_recorrido?.valor?.trim();
  const conductor = record.extraction?.conductor?.valor?.trim();
  if (rec && conductor) return `${rec} · ${conductor}`;
  return rec || conductor || record.id.slice(0, 8);
}

export function extractionForRecord(record: AppRecord): Extraction {
  if (!record.extraction) {
    return createEmptyExtraction();
  }
  return migrateLegacyTransfers(ensureExtractionShape(record.extraction));
}

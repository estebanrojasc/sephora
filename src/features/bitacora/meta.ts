import type { Extraction } from "@/features/records/types";
import { recorridoSuffix } from "./normalize-keys";
import type { Bitacora, BitacoraRow } from "./types";

/** Campos planos de bitácora listos para placeholders Excel. */
export interface BitacoraExcelFields {
  patente?: string;
  conductor?: string;
  auxiliar?: string;
  observaciones?: string;
  sector?: string;
  recorrido?: string;
  /** Cantidad de facturas (columna Fact.). */
  n_factura?: string;
  /** Monto total de la ruta. */
  total_factura?: string;
}

export interface BitacoraMetaBlock {
  bitacoraId: string;
  rowId: string;
  version: number;
  matchScore: number;
  /** Valores de la fila matinal en bitácora. */
  suggested: BitacoraExcelFields;
  /** Valores reconocidos por OCR al procesar / al hacer match. */
  recognized?: BitacoraExcelFields;
  /** Campos que el revisor aceptó desde bitácora. */
  applied?: Partial<Record<keyof BitacoraExcelFields, boolean>>;
  /** Snapshot para Excel (bitácora + campos aplicados). */
  excel: BitacoraExcelFields;
}

const FIELD = (v: string | undefined): string | undefined => {
  const t = v?.trim();
  return t || undefined;
};

/** Recorrido completo de bitácora (autoridad al guardar / aplicar / Excel). */
export function bitacoraRecorridoCanonical(row: BitacoraRow): string | undefined {
  return FIELD(row.recorrido ?? row.recorridoSuffix);
}

/** Últimos dígitos visibles en la rendición impresa — solo pista para OCR, no el valor a guardar. */
export function bitacoraRecorridoOcrHint(row: BitacoraRow): string | undefined {
  return FIELD(row.recorridoSuffix ?? recorridoSuffix(row.recorrido));
}

export function rowToExcelFields(row: BitacoraRow): BitacoraExcelFields {
  const obsParts: string[] = [];
  if (row.manualSubtype) obsParts.push(row.manualSubtype.replace(/_/g, " "));
  if (row.observacion) obsParts.push(row.observacion);

  return {
    patente: FIELD(row.patente),
    conductor: FIELD(row.conductor),
    auxiliar: FIELD(row.auxiliar),
    observaciones: obsParts.length ? obsParts.join(" · ") : undefined,
    sector: FIELD(row.sector),
    recorrido: bitacoraRecorridoCanonical(row),
    n_factura: FIELD(row.cantFact),
    total_factura: FIELD(row.montoTotal),
  };
}

export function extractionToRecognizedFields(
  extraction: Extraction
): BitacoraExcelFields {
  return {
    patente: FIELD(extraction.patente?.valor),
    conductor: FIELD(extraction.conductor?.valor),
    auxiliar: FIELD(extraction.auxiliar?.valor),
    observaciones: FIELD(extraction.observaciones?.valor),
    recorrido: FIELD(extraction.n_recorrido?.valor),
    n_factura: FIELD(extraction.cant_fact?.valor),
    total_factura: FIELD(extraction.valor_total?.valor),
  };
}

export function buildBitacoraMetaBlock(
  bitacora: Bitacora,
  row: BitacoraRow,
  matchScore: number,
  recognized?: Extraction
): BitacoraMetaBlock {
  const suggested = rowToExcelFields(row);
  const recognizedFields = recognized
    ? extractionToRecognizedFields(recognized)
    : undefined;

  return {
    bitacoraId: bitacora.id,
    rowId: row.id,
    version: bitacora.version,
    matchScore,
    suggested,
    recognized: recognizedFields,
    applied: {},
    excel: { ...suggested },
  };
}

export function markBitacoraFieldApplied(
  meta: BitacoraMetaBlock | undefined,
  field: keyof BitacoraExcelFields,
  value: string
): BitacoraMetaBlock | undefined {
  if (!meta) return meta;
  const excel = { ...meta.excel, [field]: value };
  return {
    ...meta,
    excel,
    applied: { ...meta.applied, [field]: true },
  };
}

export function applyAllBitacoraSuggested(
  meta: BitacoraMetaBlock | undefined
): BitacoraMetaBlock | undefined {
  if (!meta) return meta;
  const applied: Partial<Record<keyof BitacoraExcelFields, boolean>> = {};
  for (const key of Object.keys(meta.suggested) as (keyof BitacoraExcelFields)[]) {
    if (meta.suggested[key]) applied[key] = true;
  }
  return {
    ...meta,
    excel: { ...meta.suggested },
    applied,
  };
}

/** Mapeo campo bitácora → campo principal de extracción (si existe). */
export const BITACORA_TO_EXTRACTION: Partial<
  Record<keyof BitacoraExcelFields, keyof Extraction>
> = {
  patente: "patente",
  conductor: "conductor",
  auxiliar: "auxiliar",
  observaciones: "observaciones",
  recorrido: "n_recorrido",
  n_factura: "cant_fact",
  total_factura: "valor_total",
};

import type { Record as AppRecord } from "@/features/records/types";
import type { ScalarValue } from "./build-rendicion";

/**
 * Filas de la plantilla RUTA CFT-ABL donde la columna B lleva totales/cabecera
 * en el Excel individual. En el consolidado, cada registro ocupa una columna
 * (B = registro 1, C = registro 2, …) en las mismas filas.
 */
export interface TemplateResumenRow {
  row: number;
  placeholder: string;
  sum?: boolean;
}

export const TEMPLATE_RESUMEN_ROWS: TemplateResumenRow[] = [
  { row: 1, placeholder: "{{extraction.conductor.valor}}" },
  { row: 2, placeholder: "{{extraction.auxiliar.valor}}" },
  { row: 5, placeholder: "{{extraction.n_recorrido.valor}}" },
  { row: 6, placeholder: "{{extraction.cant_fact.valor}}", sum: true },
  { row: 7, placeholder: "{{extraction.valor_total.valor}}", sum: true },
  {
    row: 9,
    placeholder: "{{extraction.rendicion.detalles_cheques.total_billetes.valor}}",
    sum: true,
  },
  {
    row: 10,
    placeholder: "{{extraction.rendicion.detalles_cheques.total_monedas.valor}}",
    sum: true,
  },
  {
    row: 11,
    placeholder: "{{extraction.rendicion.cheques_al_dia.valor}}",
    sum: true,
  },
  {
    row: 12,
    placeholder: "{{extraction.rendicion.cheques_a_fecha.valor}}",
    sum: true,
  },
  {
    row: 13,
    placeholder: "{{extraction.rendicion.credito_vendedor.valor}}",
    sum: true,
  },
  {
    row: 14,
    placeholder: "{{extraction.rendicion.retorno_total.valor}}",
    sum: true,
  },
  {
    row: 15,
    placeholder: "{{extraction.rendicion.retorno_parcial.valor}}",
    sum: true,
  },
  {
    row: 16,
    placeholder: "{{extraction.rendicion.n_c_negocio.valor}}",
    sum: true,
  },
  {
    row: 17,
    placeholder: "{{extraction.rendicion.transferencia.valor}}",
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

export function scalarForPlaceholder(
  scalars: globalThis.Record<string, ScalarValue>,
  placeholder: string
): ScalarValue | undefined {
  return (
    scalars[placeholder] ??
    scalars[placeholder.replace("detalles_cheques", "detalle_efectivo")]
  );
}

export function recordLabel(record: AppRecord): string {
  const rec = record.extraction?.n_recorrido?.valor?.trim();
  const conductor = record.extraction?.conductor?.valor?.trim();
  if (rec && conductor) return `${rec} · ${conductor}`;
  return rec || conductor || record.id.slice(0, 8);
}

/** Primera fila del bloque de detalle (listas) — no se usa en hoja Resumen. */
export const TEMPLATE_DETAIL_START_ROW = 23;

import type { Record as AppRecord } from "@/features/records/types";
import type { ScalarValue } from "./build-rendicion";

/** Filas columna B (resumen superior) — un registro por columna B, C, D… */
export interface TemplateResumenRow {
  row: number;
  placeholder: string;
  sum?: boolean;
}

export const TEMPLATE_RESUMEN_ROWS: TemplateResumenRow[] = [
  { row: 1, placeholder: "{{extraction._meta.bitacora.excel.conductor}}" },
  { row: 2, placeholder: "{{extraction._meta.bitacora.excel.auxiliar}}" },
  { row: 3, placeholder: "{{extraction._meta.bitacora.excel.observaciones}}" },
  { row: 4, placeholder: "{{extraction._meta.bitacora.excel.sector}}" },
  { row: 5, placeholder: "{{extraction._meta.bitacora.excel.recorrido}}" },
  { row: 6, placeholder: "{{extraction._meta.bitacora.excel.n_factura}}", sum: true },
  { row: 7, placeholder: "{{extraction._meta.bitacora.excel.total_factura}}", sum: true },
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

/** Columna B = registro 0; C = registro 1; etc. */
export function summaryColumnForRecord(recordIndex: number): string {
  return excelColumn(1 + recordIndex);
}

/** Placeholders del resumen superior (columna B+); no deben reemplazarse con el merge global. */
export const RESUMEN_UPPER_SCALAR_PLACEHOLDERS = new Set(
  TEMPLATE_RESUMEN_ROWS.map((f) => f.placeholder)
);

/**
 * En consolidado, el resumen superior (filas 1–17) se rellena por registro en
 * fillUpperSummarySection. Los escalares fusionados solo deben aplicarse desde
 * esta fila hacia abajo (detalle + totales inferiores).
 */
export const CONSOLIDATED_LOWER_SECTION_START_ROW = 22;

const RESUMEN_SCALAR_FALLBACKS: Record<string, string[]> = {
  "{{extraction._meta.bitacora.excel.conductor}}": [
    "{{extraction.conductor.valor}}",
  ],
  "{{extraction._meta.bitacora.excel.auxiliar}}": [
    "{{extraction.auxiliar.valor}}",
  ],
  "{{extraction._meta.bitacora.excel.observaciones}}": [
    "{{extraction.observaciones.valor}}",
  ],
  "{{extraction._meta.bitacora.excel.recorrido}}": [
    "{{extraction.n_recorrido.valor}}",
  ],
  "{{extraction._meta.bitacora.excel.n_factura}}": [
    "{{extraction.cant_fact.valor}}",
  ],
  "{{extraction._meta.bitacora.excel.total_factura}}": [
    "{{extraction.valor_total.valor}}",
  ],
};

export function scalarForPlaceholder(
  scalars: globalThis.Record<string, ScalarValue>,
  placeholder: string
): ScalarValue | undefined {
  const direct =
    scalars[placeholder] ??
    scalars[placeholder.replace("detalles_cheques", "detalle_efectivo")];
  if (direct?.value.trim()) return direct;

  for (const alt of RESUMEN_SCALAR_FALLBACKS[placeholder] ?? []) {
    const v = scalars[alt];
    if (v?.value.trim()) return v;
  }

  return direct;
}

export function recordLabel(record: AppRecord): string {
  const rec = record.extraction?.n_recorrido?.valor?.trim();
  const conductor = record.extraction?.conductor?.valor?.trim();
  if (rec && conductor) return `${rec} · ${conductor}`;
  return rec || conductor || record.id.slice(0, 8);
}

import type { Record as AppRecord } from "@/features/records/types";
import type { ScalarValue } from "./build-rendicion";

/** Filas de la columna B de la plantilla usadas en el resumen consolidado. */
export interface ResumenField {
  row: number;
  placeholder: string;
  label: string;
  numeric: boolean;
}

export const RESUMEN_SUMMARY_FIELDS: ResumenField[] = [
  {
    row: 1,
    placeholder: "{{extraction.conductor.valor}}",
    label: "CHOFER",
    numeric: false,
  },
  {
    row: 2,
    placeholder: "{{extraction.auxiliar.valor}}",
    label: "AUXILIAR / PEONETA",
    numeric: false,
  },
  {
    row: 5,
    placeholder: "{{extraction.n_recorrido.valor}}",
    label: "RECORRIDO",
    numeric: false,
  },
  {
    row: 6,
    placeholder: "{{extraction.cant_fact.valor}}",
    label: "N° FACT.",
    numeric: true,
  },
  {
    row: 7,
    placeholder: "{{extraction.valor_total.valor}}",
    label: "TOTAL FACT.",
    numeric: true,
  },
  {
    row: 9,
    placeholder: "{{extraction.rendicion.detalles_cheques.total_billetes.valor}}",
    label: "BILLETES",
    numeric: true,
  },
  {
    row: 10,
    placeholder: "{{extraction.rendicion.detalles_cheques.total_monedas.valor}}",
    label: "MONEDAS",
    numeric: true,
  },
  {
    row: 11,
    placeholder: "{{extraction.rendicion.cheques_al_dia.valor}}",
    label: "CHEQUES AL DÍA",
    numeric: true,
  },
  {
    row: 12,
    placeholder: "{{extraction.rendicion.cheques_a_fecha.valor}}",
    label: "CHEQUES A FECHA",
    numeric: true,
  },
  {
    row: 13,
    placeholder: "{{extraction.rendicion.credito_vendedor.valor}}",
    label: "CRÉDITO VENDEDOR",
    numeric: true,
  },
  {
    row: 14,
    placeholder: "{{extraction.rendicion.retorno_total.valor}}",
    label: "NULOS (RETORNO TOTAL)",
    numeric: true,
  },
  {
    row: 15,
    placeholder: "{{extraction.rendicion.retorno_parcial.valor}}",
    label: "PARCIALES (RETORNO PARCIAL)",
    numeric: true,
  },
  {
    row: 16,
    placeholder: "{{extraction.rendicion.n_c_negocio.valor}}",
    label: "N/C NEGOCIO",
    numeric: true,
  },
  {
    row: 17,
    placeholder: "{{extraction.rendicion.transferencia.valor}}",
    label: "TRANSFERENCIAS",
    numeric: true,
  },
  {
    row: 23,
    placeholder: "{{extraction.fecha.valor}}",
    label: "FECHA",
    numeric: false,
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
export function resumenColumnForRecord(recordIndex: number): string {
  return excelColumn(1 + recordIndex);
}

export function scalarForPlaceholder(
  scalars: Record<string, ScalarValue>,
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

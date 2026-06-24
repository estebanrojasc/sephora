import { parseNumber } from "@/lib/parse-number";
import type { BilleteRow, ExtractedField, Extraction } from "./types";

function sumRowValues(rows: BilleteRow[]): number {
  let sum = 0;
  for (const row of rows) {
    const n = parseNumber(row.valor.valor);
    if (n !== null) sum += n;
  }
  return sum;
}

function hasRowData(rows: BilleteRow[]): boolean {
  return rows.some(
    (r) => r.denominacion.valor.trim() !== "" || r.valor.valor.trim() !== ""
  );
}

function totalFieldFromSum(sum: number, prev: ExtractedField): ExtractedField {
  if (sum === 0 && !prev.valor.trim()) {
    return prev;
  }
  return { ...prev, valor: String(Math.round(sum)) };
}

/** Calcula total_billetes, total_monedas y total_efectivo desde las filas de detalle. */
export function syncDetalleEfectivoTotals(extraction: Extraction): Extraction {
  const de = extraction.detalle_efectivo;
  const billetesSum = sumRowValues(de.billetes);
  const monedasSum = sumRowValues(de.monedas);
  const detalleSum = billetesSum + monedasSum;

  return {
    ...extraction,
    detalle_efectivo: {
      ...de,
      total_billetes: hasRowData(de.billetes)
        ? totalFieldFromSum(billetesSum, de.total_billetes)
        : de.total_billetes,
      total_monedas: hasRowData(de.monedas)
        ? totalFieldFromSum(monedasSum, de.total_monedas)
        : de.total_monedas,
      total_efectivo:
        detalleSum > 0 || de.total_efectivo.valor.trim()
          ? totalFieldFromSum(detalleSum, de.total_efectivo)
          : de.total_efectivo,
    },
  };
}

export function sumDetalleEfectivoRows(extraction: Extraction): number {
  const de = extraction.detalle_efectivo;
  return sumRowValues(de.billetes) + sumRowValues(de.monedas);
}

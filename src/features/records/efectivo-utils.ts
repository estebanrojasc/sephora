import type { BilleteRow } from "./types";

/** Denominaciones de monedas chilenas (pesos). */
export const MONEDA_DENOMINACIONES = new Set(["500", "100", "50", "10"]);

export function normalizeDenomKey(valor: string): string {
  const digits = valor.replace(/[^\d]/g, "");
  return digits || valor.trim();
}

export function isMonedaDenominacion(valor: string): boolean {
  return MONEDA_DENOMINACIONES.has(normalizeDenomKey(valor));
}

/** Separa filas legacy mezcladas en billetes (1000+) y monedas (500/100/50/10). */
export function splitBilletesAndMonedas(rows: BilleteRow[]): {
  billetes: BilleteRow[];
  monedas: BilleteRow[];
} {
  const billetes: BilleteRow[] = [];
  const monedas: BilleteRow[] = [];
  for (const row of rows) {
    if (isMonedaDenominacion(row.denominacion.valor)) {
      monedas.push(row);
    } else {
      billetes.push(row);
    }
  }
  return { billetes, monedas };
}

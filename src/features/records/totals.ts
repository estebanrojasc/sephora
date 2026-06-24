import { parseNumber } from "@/lib/parse-number";
import type { Extraction } from "./types";

/** Tolerancia absoluta (en pesos) para considerar que un total cuadra. */
export const TOTAL_MATCH_TOLERANCE = 1;

export interface SectionState {
  id: string;
  label: string;
  /** Cantidad de filas con algún dato. */
  itemCount: number;
  /** Suma de los items individuales. */
  sumItems: number;
  /** Total declarado (parseado). */
  declared: number | null;
  /** El campo del total venía vacío. */
  declaredEmpty: boolean;
  /** Diferencia firmada: declared - sumItems. */
  diff: number | null;
}

function safeNumber(s: string | undefined | null): number | null {
  return parseNumber(s ?? "");
}

function rowSum(values: (string | undefined | null)[]): {
  sum: number;
  count: number;
} {
  let sum = 0;
  let count = 0;
  for (const v of values) {
    const n = safeNumber(v);
    if (n !== null) {
      sum += n;
      count++;
    }
  }
  return { sum, count };
}

interface SectionInput {
  id: string;
  label: string;
  values: (string | undefined | null)[];
  declared: string | undefined | null;
  /**
   * Si la fila contó como "items" requiere total. Por default: si hay valores
   * numéricos en values, sí.
   */
  alwaysRequired?: boolean;
}

function buildSection(input: SectionInput): SectionState {
  const { sum, count } = rowSum(input.values);
  const itemCount = count;
  const declared = safeNumber(input.declared);
  const declaredEmpty = !(input.declared ?? "").trim();
  const diff = declared !== null ? declared - sum : null;
  return {
    id: input.id,
    label: input.label,
    itemCount,
    sumItems: sum,
    declared,
    declaredEmpty,
    diff,
  };
}

/**
 * Calcula el estado de cada sección con detalle (cheques, NCs, transferencias,
 * efectivo). El orden coincide con cómo se muestra en el reporte.
 */
export function computeSectionTotals(e: Extraction): SectionState[] {
  return [
    buildSection({
      id: "cheques",
      label: "Cheques",
      values: e.detalles_cheques.map((r) => r.valor.valor),
      declared: e.total_cheques.valor,
    }),
    buildSection({
      id: "n_c_rechazo_total",
      label: "N/C rechazo total",
      values: e.n_c_rechazo_total.map((r) => r.valor.valor),
      declared: e.total_n_c_rechazo_total.valor,
    }),
    buildSection({
      id: "n_c_rechazo_parcial",
      label: "N/C rechazo parcial",
      values: e.n_c_rechazo_parcial.map((r) => r.valor.valor),
      declared: e.total_n_c_rechazo_parcial.valor,
    }),
    buildSection({
      id: "n_c_por_negocios",
      label: "N/C por negocios",
      values: e.n_c_por_negocios.map((r) => r.valor.valor),
      declared: e.total_n_c_por_negocios.valor,
    }),
    buildSection({
      id: "transferencias",
      label: "Transferencias",
      values: e.detalle_transferencias.map((r) => r.valor.valor),
      declared: e.total_transferencias.valor,
    }),
    buildSection({
      id: "efectivo",
      label: "Efectivo",
      values: e.detalle_efectivo.billetes.map((b) => b.valor.valor),
      declared: e.detalle_efectivo.total_efectivo.valor,
    }),
  ];
}

/**
 * Devuelve las secciones que tienen filas pero NO tienen total declarado.
 * Esos totales son los que el usuario debe llenar antes de poder guardar
 * el registro. Si el usuario quiere, puede usar el botón "Usar suma" del
 * reporte para sembrar el total con la suma de los items.
 */
export function getMissingTotals(e: Extraction): SectionState[] {
  return computeSectionTotals(e).filter(
    (s) => s.itemCount > 0 && s.declaredEmpty
  );
}

/**
 * Devuelve las secciones que tienen total declarado y suma de items, pero
 * cuyos números no cuadran (con la tolerancia configurada).
 */
export function getMismatches(e: Extraction): SectionState[] {
  return computeSectionTotals(e).filter(
    (s) =>
      s.itemCount > 0 &&
      !s.declaredEmpty &&
      s.diff !== null &&
      Math.abs(s.diff) > TOTAL_MATCH_TOLERANCE
  );
}

/**
 * Estado global del registro: si está listo para guardar y/o si hay
 * discrepancias relevantes para mostrar en el reporte.
 */
export interface ExtractionTotalsStatus {
  missing: SectionState[];
  mismatches: SectionState[];
  /** Suma global de todos los totales declarados (cuando existen). */
  declaredGrandTotal: number;
  canSave: boolean;
  cuadrado: boolean;
}

export function getTotalsStatus(e: Extraction): ExtractionTotalsStatus {
  const sections = computeSectionTotals(e);
  const missing = sections.filter(
    (s) => s.itemCount > 0 && s.declaredEmpty
  );
  const mismatches = sections.filter(
    (s) =>
      s.itemCount > 0 &&
      !s.declaredEmpty &&
      s.diff !== null &&
      Math.abs(s.diff) > TOTAL_MATCH_TOLERANCE
  );

  const declaredGrandTotal = sections.reduce(
    (acc, s) => acc + (s.declared ?? 0),
    0
  );

  return {
    missing,
    mismatches,
    declaredGrandTotal,
    canSave: missing.length === 0,
    cuadrado: missing.length === 0 && mismatches.length === 0,
  };
}

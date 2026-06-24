import { parseNumber } from "@/lib/parse-number";
import { ensureExtractionShape, type Extraction } from "./types";

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
  const shaped = ensureExtractionShape(e);
  return [
    buildSection({
      id: "cheques",
      label: "Cheques",
      values: shaped.detalles_cheques.map((r) => r.valor.valor),
      declared: shaped.total_cheques.valor,
    }),
    buildSection({
      id: "n_c_rechazo_total",
      label: "Nulos (rechazo total)",
      values: shaped.n_c_rechazo_total.map((r) => r.valor.valor),
      declared:
        shaped.total_n_c_rechazo_total.valor ||
        shaped.rendicion.retorno_total.valor,
    }),
    buildSection({
      id: "n_c_rechazo_parcial",
      label: "Parciales (rechazo parcial)",
      values: shaped.n_c_rechazo_parcial.map((r) => r.valor.valor),
      declared:
        shaped.total_n_c_rechazo_parcial.valor ||
        shaped.rendicion.retorno_parcial.valor,
    }),
    buildSection({
      id: "n_c_por_negocios",
      label: "N/C por negocios",
      values: shaped.n_c_por_negocios.map((r) => r.valor.valor),
      declared: shaped.total_n_c_por_negocios.valor,
    }),
    buildSection({
      id: "transferencias",
      label: "Transferencias",
      values: shaped.detalle_transferencias.map((r) => r.valor.valor),
      declared: shaped.total_transferencias.valor,
    }),
    buildSection({
      id: "credito_vendedor",
      label: "Crédito vendedor",
      values: shaped.detalle_credito_vendedor.map((r) => r.valor.valor),
      declared: shaped.rendicion.credito_vendedor.valor,
    }),
    buildSection({
      id: "billetes",
      label: "Billetes",
      values: shaped.detalle_efectivo.billetes.map((b) => b.valor.valor),
      declared: shaped.detalle_efectivo.total_billetes.valor,
    }),
    buildSection({
      id: "monedas",
      label: "Monedas",
      values: shaped.detalle_efectivo.monedas.map((b) => b.valor.valor),
      declared: shaped.detalle_efectivo.total_monedas.valor,
    }),
    buildSection({
      id: "efectivo",
      label: "Efectivo (total)",
      values: [
        ...shaped.detalle_efectivo.billetes.map((b) => b.valor.valor),
        ...shaped.detalle_efectivo.monedas.map((b) => b.valor.valor),
      ],
      declared: shaped.detalle_efectivo.total_efectivo.valor,
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
  /** Total en rendición sin filas detalle (nulos/parciales). */
  rendicionWithoutRows: SectionState[];
  /** Suma global de todos los totales declarados (cuando existen). */
  declaredGrandTotal: number;
  canSave: boolean;
  cuadrado: boolean;
}

function getRendicionWithoutRows(e: Extraction): SectionState[] {
  const shaped = ensureExtractionShape(e);
  const warnings: SectionState[] = [];

  const retornoTotal = safeNumber(shaped.rendicion.retorno_total.valor);
  if (
    retornoTotal !== null &&
    retornoTotal > 0 &&
    shaped.n_c_rechazo_total.length === 0
  ) {
    warnings.push({
      id: "rendicion_retorno_total",
      label: "Nulos (rechazo total)",
      itemCount: 0,
      sumItems: 0,
      declared: retornoTotal,
      declaredEmpty: false,
      diff: null,
    });
  }

  const retornoParcial = safeNumber(shaped.rendicion.retorno_parcial.valor);
  if (
    retornoParcial !== null &&
    retornoParcial > 0 &&
    shaped.n_c_rechazo_parcial.length === 0
  ) {
    warnings.push({
      id: "rendicion_retorno_parcial",
      label: "Parciales (rechazo parcial)",
      itemCount: 0,
      sumItems: 0,
      declared: retornoParcial,
      declaredEmpty: false,
      diff: null,
    });
  }

  return warnings;
}

export function getTotalsStatus(e: Extraction): ExtractionTotalsStatus {
  const sections = computeSectionTotals(ensureExtractionShape(e));
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
    rendicionWithoutRows: getRendicionWithoutRows(e),
    declaredGrandTotal,
    canSave: missing.length === 0,
    cuadrado: missing.length === 0 && mismatches.length === 0,
  };
}

export type TotalFieldIssue = "missing" | "mismatch";

/** editKey del FieldInput vinculado a cada sección con validación de totales. */
export const SECTION_TOTAL_FIELD_KEYS: Record<string, string> = {
  cheques: "total_cheques",
  n_c_rechazo_total: "total_n_c_rechazo_total",
  n_c_rechazo_parcial: "total_n_c_rechazo_parcial",
  n_c_por_negocios: "total_n_c_por_negocios",
  transferencias: "total_transferencias",
  credito_vendedor: "rendicion.credito_vendedor",
  billetes: "detalle_efectivo.total_billetes",
  monedas: "detalle_efectivo.total_monedas",
  efectivo: "detalle_efectivo.total_efectivo",
};

/** Totales alternativos en rendición (nulos/parciales) cuando falta el de detalle. */
const SECTION_RENDICION_FALLBACK_KEYS: Partial<Record<string, string>> = {
  n_c_rechazo_total: "rendicion.retorno_total",
  n_c_rechazo_parcial: "rendicion.retorno_parcial",
};

/**
 * Mapa editKey → problema para resaltar en rojo el cuadro de total a corregir.
 * Prioriza "missing" sobre "mismatch".
 */
export function getTotalFieldIssues(
  status: Pick<ExtractionTotalsStatus, "missing" | "mismatches">
): Map<string, TotalFieldIssue> {
  const map = new Map<string, TotalFieldIssue>();

  for (const s of status.missing) {
    const key = SECTION_TOTAL_FIELD_KEYS[s.id];
    if (key) map.set(key, "missing");
    const fallback = SECTION_RENDICION_FALLBACK_KEYS[s.id];
    if (fallback) map.set(fallback, "missing");
  }

  for (const s of status.mismatches) {
    const key = SECTION_TOTAL_FIELD_KEYS[s.id];
    if (key && !map.has(key)) map.set(key, "mismatch");
  }

  return map;
}

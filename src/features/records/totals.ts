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
      id: "efectivo",
      label: "Efectivo (rendición)",
      values: [
        ...shaped.detalle_efectivo.billetes.map((b) => b.valor.valor),
        ...shaped.detalle_efectivo.monedas.map((b) => b.valor.valor),
      ],
      declared: shaped.rendicion.efectivo_total.valor,
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

/**
 * Totales declarados en rendición/sección sin ninguna fila de detalle con monto.
 * Antes solo se avisaba nulos/parciales; crédito vendedor y transferencias
 * podían guardarse "completos" con solo el total → Excel/PDF sin líneas.
 */
function getRendicionWithoutRows(e: Extraction): SectionState[] {
  const shaped = ensureExtractionShape(e);
  const warnings: SectionState[] = [];

  const pushIfOrphan = (
    id: string,
    label: string,
    declaredRaw: string | undefined | null,
    detailCount: number
  ) => {
    const declared = safeNumber(declaredRaw);
    if (declared !== null && declared > 0 && detailCount === 0) {
      warnings.push({
        id,
        label,
        itemCount: 0,
        sumItems: 0,
        declared,
        declaredEmpty: false,
        diff: null,
      });
    }
  };

  pushIfOrphan(
    "rendicion_retorno_total",
    "Nulos (rechazo total)",
    shaped.rendicion.retorno_total.valor,
    rowSum(shaped.n_c_rechazo_total.map((r) => r.valor.valor)).count
  );
  pushIfOrphan(
    "rendicion_retorno_parcial",
    "Parciales (rechazo parcial)",
    shaped.rendicion.retorno_parcial.valor,
    rowSum(shaped.n_c_rechazo_parcial.map((r) => r.valor.valor)).count
  );
  pushIfOrphan(
    "credito_vendedor",
    "Crédito vendedor",
    shaped.rendicion.credito_vendedor.valor,
    rowSum(shaped.detalle_credito_vendedor.map((r) => r.valor.valor)).count
  );
  pushIfOrphan(
    "transferencias",
    "Transferencias",
    shaped.total_transferencias.valor || shaped.rendicion.transferencia.valor,
    rowSum(shaped.detalle_transferencias.map((r) => r.valor.valor)).count
  );

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
  const rendicionWithoutRows = getRendicionWithoutRows(e);

  const declaredGrandTotal = sections.reduce(
    (acc, s) => acc + (s.declared ?? 0),
    0
  );

  // Bloquea guardar si hay total sin filas de detalle (p. ej. solo crédito
  // vendedor): el registro quedaba "saved" pero Excel/PDF salían vacíos.
  const canSave = missing.length === 0 && rendicionWithoutRows.length === 0;

  return {
    missing,
    mismatches,
    rendicionWithoutRows,
    declaredGrandTotal,
    canSave,
    cuadrado:
      missing.length === 0 &&
      mismatches.length === 0 &&
      rendicionWithoutRows.length === 0,
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
  efectivo: "rendicion.efectivo_total",
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
  status: Pick<
    ExtractionTotalsStatus,
    "missing" | "mismatches" | "rendicionWithoutRows"
  >
): Map<string, TotalFieldIssue> {
  const map = new Map<string, TotalFieldIssue>();

  for (const s of status.missing) {
    const key = SECTION_TOTAL_FIELD_KEYS[s.id];
    if (key) map.set(key, "missing");
    const fallback = SECTION_RENDICION_FALLBACK_KEYS[s.id];
    if (fallback) map.set(fallback, "missing");
  }

  for (const s of status.rendicionWithoutRows) {
    // Mapear ids de warning a la clave de campo editable.
    const sectionId =
      s.id === "rendicion_retorno_total"
        ? "n_c_rechazo_total"
        : s.id === "rendicion_retorno_parcial"
          ? "n_c_rechazo_parcial"
          : s.id;
    const key = SECTION_TOTAL_FIELD_KEYS[sectionId];
    if (key && !map.has(key)) map.set(key, "missing");
    const fallback = SECTION_RENDICION_FALLBACK_KEYS[sectionId];
    if (fallback && !map.has(fallback)) map.set(fallback, "missing");
  }

  for (const s of status.mismatches) {
    const key = SECTION_TOTAL_FIELD_KEYS[s.id];
    if (key && !map.has(key)) map.set(key, "mismatch");
  }

  return map;
}

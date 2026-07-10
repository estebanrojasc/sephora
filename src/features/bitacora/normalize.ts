import { newId } from "@/lib/id";
import { formatExtractedDateChilean, parseToIso } from "@/lib/date-utils";
import { normalizeInvoiceNumber, normalizeThousandsDisplay } from "@/lib/parse-number";
import type { BitacoraRow, BitacoraRowType } from "./types";
import { normalizePatente, recorridoSuffix } from "./normalize-keys";

const ROW_TYPES = new Set<BitacoraRowType>([
  "ruta",
  "entrega_pendiente",
  "manual",
  "totals",
  "header",
  "unknown",
]);

function asString(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

function normalizeRowType(v: unknown): BitacoraRowType {
  const s = asString(v);
  if (s && ROW_TYPES.has(s as BitacoraRowType)) return s as BitacoraRowType;
  return "unknown";
}

function normalizeDateField(v: unknown): string | undefined {
  const raw = asString(v);
  if (!raw) return undefined;
  const iso = parseToIso(raw);
  return iso ?? formatExtractedDateChilean(raw) ?? raw;
}

export function normalizeBitacoraRow(input: unknown): BitacoraRow {
  const obj =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  const recorrido = asString(obj.recorrido);
  const patente = asString(obj.patente);

  return {
    id: asString(obj.id) ?? newId(),
    rowType: normalizeRowType(obj.rowType),
    manualSubtype: asString(obj.manualSubtype),
    territorio: asString(obj.territorio),
    anden: asString(obj.anden),
    patente: patente ? normalizePatenteDisplay(patente) : undefined,
    conductor: asString(obj.conductor),
    auxiliar: asString(obj.auxiliar),
    observacion: asString(obj.observacion),
    sector: asString(obj.sector),
    recorrido,
    recorridoSuffix:
      asString(obj.recorridoSuffix) ??
      (recorrido ? recorridoSuffix(recorrido) : undefined),
    primerFolio: (() => {
      const v = asString(obj.primerFolio);
      return v ? normalizeInvoiceNumber(v) || v : undefined;
    })(),
    ultimoFolio: (() => {
      const v = asString(obj.ultimoFolio);
      return v ? normalizeInvoiceNumber(v) || v : undefined;
    })(),
    cantFact: asString(obj.cantFact),
    puntos: asString(obj.puntos),
    montoTotal: obj.montoTotal
      ? normalizeThousandsDisplay(asString(obj.montoTotal))
      : undefined,
    scheduledDate: normalizeDateField(obj.scheduledDate),
    linkedRecordId: asString(obj.linkedRecordId),
    linkedRecordIds: normalizeLinkedRecordIds(obj),
    allowsMultipleReviews:
      typeof obj.allowsMultipleReviews === "boolean"
        ? obj.allowsMultipleReviews
        : undefined,
  };
}

function normalizeLinkedRecordIds(
  obj: Record<string, unknown>
): string[] | undefined {
  const ids = new Set<string>();
  const legacy = asString(obj.linkedRecordId);
  if (legacy) ids.add(legacy);
  if (Array.isArray(obj.linkedRecordIds)) {
    for (const id of obj.linkedRecordIds) {
      const s = asString(id);
      if (s) ids.add(s);
    }
  }
  return ids.size > 0 ? [...ids] : undefined;
}

/** Formato legible para patentes (TWBD - 63). */
export function normalizePatenteDisplay(value: string): string {
  const compact = normalizePatente(value);
  if (compact.length <= 4) return value.trim();
  const letters = compact.slice(0, -2);
  const nums = compact.slice(-2);
  if (/^\d+$/.test(nums) && /^[A-Z]+$/.test(letters)) {
    return `${letters.slice(0, 4)} - ${nums}`;
  }
  return value.trim();
}

export function normalizeBitacoraParseResult(raw: unknown): {
  date: string;
  title?: string;
  rows: BitacoraRow[];
  warnings: string[];
} {
  const obj =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const warnings = Array.isArray(obj.warnings)
    ? obj.warnings.map(String)
    : [];

  const dateRaw = asString(obj.date);
  const dateIso = dateRaw ? parseToIso(dateRaw) : null;

  const rowsRaw = Array.isArray(obj.rows) ? obj.rows : [];
  const rows = rowsRaw
    .map(normalizeBitacoraRow)
    .filter((r) => r.rowType !== "header");

  return {
    date: dateIso ?? dateRaw ?? "",
    title: asString(obj.title),
    rows,
    warnings,
  };
}

export function stripJsonFences(s: string): string {
  return s
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

export function parseBitacoraFromText(raw: string): ReturnType<
  typeof normalizeBitacoraParseResult
> {
  const trimmed = stripJsonFences(raw);
  try {
    const parsed = JSON.parse(trimmed);
    return normalizeBitacoraParseResult(parsed);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "JSON inválido";
    throw new Error(`La IA devolvió un JSON inválido: ${message}`);
  }
}

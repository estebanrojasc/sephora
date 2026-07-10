import {
  createEmptyExtraction,
  type Bbox,
  type BilleteRow,
  type ChequeRow,
  type ExtractedDetalleEfectivo,
  type ExtractedField,
  type Extraction,
  type NCRow,
  type TransferenciaRow,
  type CreditoVendedorRow,
} from "@/features/records/types";
import { splitBilletesAndMonedas } from "@/features/records/efectivo-utils";
import { formatExtractedDateChilean } from "@/lib/date-utils";
import {
  normalizeInvoiceNumber,
  normalizeThousandsDisplay,
} from "@/lib/parse-number";
import { normalizeTransferBankCode } from "@/features/records/transfer-bank";

const EMPTY_BBOX: Bbox = [0, 0, 0, 0];

function asObject(input: unknown): Record<string, unknown> | null {
  return input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
}

function coerceDateField(field: ExtractedField): ExtractedField {
  if (!field.valor.trim()) return field;
  return {
    ...field,
    valor: formatExtractedDateChilean(field.valor),
  };
}

function coerceAmountField(field: ExtractedField): ExtractedField {
  if (!field.valor.trim()) return field;
  return {
    ...field,
    valor: normalizeThousandsDisplay(field.valor),
  };
}

function coerceInvoiceField(field: ExtractedField): ExtractedField {
  if (!field.valor.trim()) return field;
  const next = normalizeInvoiceNumber(field.valor);
  return next === field.valor ? field : { ...field, valor: next };
}

function fillFieldRaw(input: unknown): ExtractedField {
  if (typeof input === "string") {
    return { valor: input, bbox: [...EMPTY_BBOX] };
  }
  if (typeof input === "number" && Number.isFinite(input)) {
    return { valor: String(input), bbox: [...EMPTY_BBOX] };
  }
  const obj = asObject(input);
  if (!obj) return { valor: "", bbox: [...EMPTY_BBOX] };

  const valor =
    typeof obj.valor === "string"
      ? obj.valor
      : obj.valor != null
        ? String(obj.valor)
        : "";

  const bb = obj.bbox;
  const bbox: Bbox =
    Array.isArray(bb) &&
    bb.length === 4 &&
    bb.every((n) => typeof n === "number" && Number.isFinite(n))
      ? ([bb[0], bb[1], bb[2], bb[3]] as Bbox)
      : [...EMPTY_BBOX];

  return { valor, bbox };
}

function fillField(input: unknown): ExtractedField {
  const field = fillFieldRaw(input);
  if (!field.valor.trim()) return field;
  return {
    ...field,
    valor: normalizeThousandsDisplay(field.valor),
  };
}

function fillInvoiceField(input: unknown): ExtractedField {
  return coerceInvoiceField(fillFieldRaw(input));
}

function fillChequeRow(input: unknown): ChequeRow {
  const obj = asObject(input) ?? {};
  return {
    fecha: coerceDateField(fillFieldRaw(obj.fecha)),
    banco: fillFieldRaw(obj.banco),
    valor: coerceAmountField(fillFieldRaw(obj.valor)),
  };
}

function fillNcRow(input: unknown): NCRow {
  const obj = asObject(input) ?? {};
  return {
    no_fac: fillInvoiceField(obj.no_fac),
    valor: coerceAmountField(fillFieldRaw(obj.valor)),
  };
}

function fillTransferenciaRow(input: unknown): TransferenciaRow {
  const obj = asObject(input) ?? {};
  const banco = fillFieldRaw(obj.banco);
  const code = normalizeTransferBankCode(banco.valor);
  return {
    no_fac: fillInvoiceField(obj.no_fac),
    valor: coerceAmountField(fillFieldRaw(obj.valor)),
    cliente: fillFieldRaw(obj.cliente),
    banco: code !== banco.valor ? { ...banco, valor: code } : banco,
  };
}

function fillCreditoVendedorRow(input: unknown): CreditoVendedorRow {
  const obj = asObject(input) ?? {};
  return {
    no_fac: fillInvoiceField(obj.no_fac),
    valor: coerceAmountField(fillFieldRaw(obj.valor)),
    cliente: fillFieldRaw(obj.cliente),
    nro_vendedor: fillFieldRaw(obj.nro_vendedor),
  };
}

function fillBilleteRow(input: unknown): BilleteRow {
  const obj = asObject(input) ?? {};
  return {
    denominacion: fillField(obj.denominacion),
    valor: fillField(obj.valor),
  };
}

function fillArray<T>(
  input: unknown,
  mapper: (row: unknown) => T,
  shouldKeep: (row: T) => boolean
): T[] {
  if (!Array.isArray(input)) return [];
  return input
    .map(mapper)
    .filter(shouldKeep);
}

function chequeFilled(row: ChequeRow): boolean {
  return (
    !!row.fecha.valor.trim() ||
    !!row.banco.valor.trim() ||
    !!row.valor.valor.trim()
  );
}

function ncFilled(row: NCRow): boolean {
  return !!row.no_fac.valor.trim() || !!row.valor.valor.trim();
}

function transferenciaFilled(row: TransferenciaRow): boolean {
  return ncFilled(row);
}

function creditoVendedorFilled(row: CreditoVendedorRow): boolean {
  return (
    !!row.no_fac.valor.trim() ||
    !!row.valor.valor.trim() ||
    !!row.cliente.valor.trim() ||
    !!row.nro_vendedor.valor.trim()
  );
}

function billeteFilled(row: BilleteRow): boolean {
  return !!row.denominacion.valor.trim() || !!row.valor.valor.trim();
}

function normalizeDetalleEfectivoFromRaw(
  raw: Record<string, unknown>
): ExtractedDetalleEfectivo {
  let billetes = fillArray(raw.billetes, fillBilleteRow, billeteFilled);
  let monedas = fillArray(raw.monedas, fillBilleteRow, billeteFilled);

  if (monedas.length === 0 && billetes.length > 0) {
    const split = splitBilletesAndMonedas(billetes);
    billetes = split.billetes;
    monedas = split.monedas;
  }

  return {
    billetes,
    monedas,
    total_billetes: fillField(raw.total_billetes),
    total_monedas: fillField(raw.total_monedas),
    total_efectivo: fillField(raw.total_efectivo),
  };
}

interface NumericToken {
  /** Texto del token tal cual aparece (ej. "1.048.822", "593149"). */
  value: string;
  /** Inicio en la cadena original. */
  start: number;
  /** Fin (exclusivo) en la cadena original. */
  end: number;
}

const NUMERIC_TOKEN_RE = /\d[\d.,]*/g;

/**
 * Heurísticas:
 *  - Un token con separador `.` o `,` interno (ej. "1.048.822", "180.220") es
 *    presumiblemente un MONTO. El token numérico inmediatamente anterior es
 *    la factura asociada. Esta es la pasada principal: anclar montos por
 *    separador es muy robusto y permite detectar varios pares en una sola
 *    línea (caso típico cuando el modelo concatena todo en `observaciones`).
 *  - Si esa pasada no encontró pares (porque no hay separadores escritos),
 *    intentamos un emparejamiento secuencial: token[0]+token[1], token[2]+
 *    token[3], etc. Validamos factura (3-9 dígitos) y monto (>= 1000).
 *
 * Devuelve los pares + un "leftover" que conserva los tokens que NO fueron
 * consumidos. El nombre de cliente entre factura y monto se captura en cada
 * fila; no se deja en el leftover.
 */
function sliceClienteText(
  line: string,
  facToken: NumericToken,
  amtToken: NumericToken
): string {
  const raw = line.slice(facToken.end, amtToken.start).trim();
  return raw.replace(/^[,:\-–—\s]+|[,:\-–—\s]+$/g, "").trim();
}

function parseTransferLine(line: string): {
  rows: { fac: string; amount: string; cliente: string }[];
  leftover: string;
} {
  const tokens: NumericToken[] = [];
  for (const m of line.matchAll(NUMERIC_TOKEN_RE)) {
    tokens.push({
      value: m[0],
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
    });
  }
  if (tokens.length < 2) return { rows: [], leftover: line };

  const consumed = new Set<number>();
  const rows: { fac: string; amount: string; cliente: string }[] = [];

  const tryPair = (facIdx: number, amtIdx: number): boolean => {
    if (
      facIdx < 0 ||
      amtIdx < 0 ||
      facIdx >= tokens.length ||
      amtIdx >= tokens.length
    )
      return false;
    if (consumed.has(facIdx) || consumed.has(amtIdx)) return false;

    const fac = tokens[facIdx].value;
    const amt = tokens[amtIdx].value;
    const facDigits = fac.replace(/[^\d]/g, "");
    if (facDigits.length < 3 || facDigits.length > 9) return false;

    const amountNum = Number(amt.replace(/[^\d]/g, ""));
    if (!Number.isFinite(amountNum) || amountNum < 1000) return false;

    rows.push({
      fac: facDigits,
      amount: amt,
      cliente: sliceClienteText(line, tokens[facIdx], tokens[amtIdx]),
    });
    consumed.add(facIdx);
    consumed.add(amtIdx);
    return true;
  };

  // Pasada principal: cada token con separador "." o "," interno se considera
  // monto, y se intenta emparejar con el token anterior (factura).
  for (let i = 1; i < tokens.length; i++) {
    if (consumed.has(i)) continue;
    if (!/[.,]/.test(tokens[i].value)) continue;
    tryPair(i - 1, i);
  }

  // Pasada de respaldo: secuencial (factura, monto) en pares consecutivos
  // SIEMPRE que ningún emparejamiento previo haya consumido esos tokens.
  if (rows.length === 0) {
    for (let i = 0; i + 1 < tokens.length; i += 2) {
      tryPair(i, i + 1);
    }
  }

  if (rows.length === 0) return { rows: [], leftover: line };

  // Construye el leftover: texto sin los rangos consumidos. Si entre dos
  // rangos solo queda el nombre del cliente, ya fue capturado en la fila.
  const consumedRanges = [...consumed]
    .sort((a, b) => a - b)
    .map((i) => ({ start: tokens[i].start, end: tokens[i].end }));

  const pieces: string[] = [];
  let cursor = 0;
  for (const r of consumedRanges) {
    if (r.start > cursor) {
      pieces.push(line.slice(cursor, r.start));
    }
    cursor = r.end;
  }
  if (cursor < line.length) pieces.push(line.slice(cursor));

  // Si el fragmento contiene SOLO letras (nombres) y separadores ("- = , :"),
  // lo eliminamos. Si tiene dígitos no consumidos (ej. "-600"), se conserva.
  const ALPHA_ONLY = /^[\sA-Za-zÁÉÍÓÚÑáéíóúñ\-=:.,;()/]+$/;
  const cleaned = pieces
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !ALPHA_ONLY.test(p))
    .join(" ");

  return { rows, leftover: cleaned };
}

/**
 * Recoge transferencias estructuradas que el modelo haya dejado dentro del
 * texto libre de "observaciones" y las devuelve como filas N/C, junto con
 * el texto sobrante (lo que NO era transferencia).
 *
 * Exportado: lo usa también el reporte para migrar al vuelo registros
 * persistidos antes del cambio de schema.
 */
export function harvestTransfersFromObservations(text: string): {
  rows: TransferenciaRow[];
  leftover: string;
} {
  if (!text.trim()) return { rows: [], leftover: text };

  const rows: TransferenciaRow[] = [];
  const remainingLines: string[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine.trim()) {
      remainingLines.push(rawLine);
      continue;
    }
    const parsed = parseTransferLine(rawLine);
    for (const r of parsed.rows) {
      rows.push({
        no_fac: { valor: r.fac, bbox: [...EMPTY_BBOX] },
        valor: { valor: r.amount, bbox: [...EMPTY_BBOX] },
        cliente: { valor: r.cliente, bbox: [...EMPTY_BBOX] },
        banco: { valor: "", bbox: [...EMPTY_BBOX] },
      });
    }
    if (parsed.leftover.trim()) remainingLines.push(parsed.leftover);
  }

  const leftover = remainingLines.join("\n").replace(/^\s+|\s+$/g, "");
  return { rows, leftover };
}

export function dedupeNcRows(rows: NCRow[]): NCRow[] {
  const seen = new Set<string>();
  const out: NCRow[] = [];
  for (const r of rows) {
    const fac = r.no_fac.valor.replace(/\s/g, "");
    const val = r.valor.valor.replace(/[^\d]/g, "");
    if (!fac && !val) continue;
    const key = `${fac}::${val}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export function dedupeTransferenciaRows(
  rows: TransferenciaRow[]
): TransferenciaRow[] {
  const byKey = new Map<string, TransferenciaRow>();
  for (const r of rows) {
    const fac = r.no_fac.valor.replace(/\s/g, "");
    const val = r.valor.valor.replace(/[^\d]/g, "");
    if (!fac && !val) continue;
    const key = `${fac}::${val}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, r);
      continue;
    }
    byKey.set(key, {
      no_fac: existing.no_fac,
      valor: existing.valor,
      cliente: existing.cliente.valor.trim()
        ? existing.cliente
        : r.cliente,
      banco: existing.banco.valor.trim() ? existing.banco : r.banco,
    });
  }
  return [...byKey.values()];
}

/**
 * Asegura que `raw` (lo que devuelve el modelo) cumple la forma de `Extraction`,
 * incluso si vino sin bboxes o con campos faltantes. Cuando faltan bboxes, se
 * rellenan con `[0,0,0,0]` para que el resto del sistema funcione igual y el
 * admin pueda marcarlos a mano.
 */
export function normalizeExtractionShape(raw: unknown): Extraction {
  const base = createEmptyExtraction();
  const obj = asObject(raw);
  if (!obj) return base;

  const rendIn = asObject(obj.rendicion) ?? {};
  const efectIn = asObject(obj.detalle_efectivo) ?? {};

  // Construimos primero el shape base con lo que el modelo entregó tal cual.
  const observacionesField = fillField(obj.observaciones);
  const transferenciasFromModel = fillArray(
    obj.detalle_transferencias,
    fillTransferenciaRow,
    transferenciaFilled
  );

  // Post-proceso defensivo: si el modelo metió las transferencias dentro
  // de "observaciones" en lugar de "detalle_transferencias", las migramos
  // automáticamente. Las filas duplicadas se eliminan por (no_fac, valor).
  const harvested = harvestTransfersFromObservations(observacionesField.valor);
  const detalleTransferencias = dedupeTransferenciaRows([
    ...transferenciasFromModel,
    ...harvested.rows,
  ]);
  const observacionesFinal: ExtractedField = {
    ...observacionesField,
    valor: harvested.leftover,
  };

  return {
    fecha: coerceDateField(fillField(obj.fecha)),
    conductor: fillField(obj.conductor),
    auxiliar: fillField(obj.auxiliar),
    n_recorrido: fillField(obj.n_recorrido),
    patente: fillField(obj.patente),
    cant_fact: fillField(obj.cant_fact),
    valor_total: fillField(obj.valor_total),
    rendicion: {
      efectivo_total: fillField(rendIn.efectivo_total),
      cheques_al_dia: fillField(rendIn.cheques_al_dia),
      cheques_a_fecha: fillField(rendIn.cheques_a_fecha),
      credito_vendedor: fillField(rendIn.credito_vendedor),
      retorno_total: fillField(rendIn.retorno_total),
      retorno_parcial: fillField(rendIn.retorno_parcial),
      n_c_negocio: fillField(rendIn.n_c_negocio),
      transferencia: fillField(rendIn.transferencia),
      total: fillField(rendIn.total),
    },
    detalles_cheques: fillArray(
      obj.detalles_cheques,
      fillChequeRow,
      chequeFilled
    ),
    total_cheques: fillField(obj.total_cheques),
    n_c_rechazo_total: fillArray(obj.n_c_rechazo_total, fillNcRow, ncFilled),
    n_c_rechazo_parcial: fillArray(
      obj.n_c_rechazo_parcial,
      fillNcRow,
      ncFilled
    ),
    n_c_por_negocios: fillArray(obj.n_c_por_negocios, fillNcRow, ncFilled),
    detalle_transferencias: detalleTransferencias,
    detalle_credito_vendedor: fillArray(
      obj.detalle_credito_vendedor,
      fillCreditoVendedorRow,
      creditoVendedorFilled
    ),
    detalle_efectivo: normalizeDetalleEfectivoFromRaw(efectIn),
    total_n_c_rechazo_total: fillField(obj.total_n_c_rechazo_total),
    total_n_c_rechazo_parcial: fillField(obj.total_n_c_rechazo_parcial),
    total_n_c_por_negocios: fillField(obj.total_n_c_por_negocios),
    total_transferencias: fillField(obj.total_transferencias),
    numero_deposito_en_efectivo: fillField(obj.numero_deposito_en_efectivo),
    monto_deposito_en_efectivo: fillField(obj.monto_deposito_en_efectivo),
    observaciones: observacionesFinal,
  };
}

export function stripJsonFences(s: string): string {
  return s
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");
}

export function parseExtractionFromText(raw: string): Extraction {
  const trimmed = stripJsonFences(raw).trim();
  try {
    const parsed = JSON.parse(trimmed);
    return normalizeExtractionShape(parsed);
  } catch {
    console.error("Respuesta no JSON del modelo:", raw.slice(0, 500));
    throw new Error("La respuesta del modelo no es JSON válido");
  }
}

function swapBbox(bb: Bbox): Bbox {
  return [bb[1], bb[0], bb[3], bb[2]];
}

function swapField(field: ExtractedField): ExtractedField {
  const isEmpty = field.bbox.every((n) => n === 0);
  if (isEmpty) return field;
  return { ...field, bbox: swapBbox(field.bbox) };
}

function swapChequeRow(row: ChequeRow): ChequeRow {
  return {
    fecha: swapField(row.fecha),
    banco: swapField(row.banco),
    valor: swapField(row.valor),
  };
}

function swapNcRow(row: NCRow): NCRow {
  return {
    no_fac: swapField(row.no_fac),
    valor: swapField(row.valor),
  };
}

function swapTransferenciaRow(row: TransferenciaRow): TransferenciaRow {
  return {
    no_fac: swapField(row.no_fac),
    valor: swapField(row.valor),
    cliente: swapField(row.cliente),
    banco: swapField(row.banco),
  };
}

function swapCreditoVendedorRow(row: CreditoVendedorRow): CreditoVendedorRow {
  return {
    no_fac: swapField(row.no_fac),
    valor: swapField(row.valor),
    cliente: swapField(row.cliente),
    nro_vendedor: swapField(row.nro_vendedor),
  };
}

function swapBilleteRow(row: BilleteRow): BilleteRow {
  return {
    denominacion: swapField(row.denominacion),
    valor: swapField(row.valor),
  };
}

/**
 * Convierte una extracción cuyos bboxes vienen en formato `[y_min, x_min, y_max, x_max]`
 * (orden nativo de Gemini) a nuestro formato canónico `[x_min, y_min, x_max, y_max]`.
 */
export function swapBboxAxes(extraction: Extraction): Extraction {
  return {
    ...extraction,
    fecha: swapField(extraction.fecha),
    conductor: swapField(extraction.conductor),
    auxiliar: swapField(extraction.auxiliar),
    n_recorrido: swapField(extraction.n_recorrido),
    patente: swapField(extraction.patente),
    cant_fact: swapField(extraction.cant_fact),
    valor_total: swapField(extraction.valor_total),
    rendicion: {
      efectivo_total: swapField(extraction.rendicion.efectivo_total),
      cheques_al_dia: swapField(extraction.rendicion.cheques_al_dia),
      cheques_a_fecha: swapField(extraction.rendicion.cheques_a_fecha),
      credito_vendedor: swapField(extraction.rendicion.credito_vendedor),
      retorno_total: swapField(extraction.rendicion.retorno_total),
      retorno_parcial: swapField(extraction.rendicion.retorno_parcial),
      n_c_negocio: swapField(extraction.rendicion.n_c_negocio),
      transferencia: swapField(extraction.rendicion.transferencia),
      total: swapField(extraction.rendicion.total),
    },
    detalles_cheques: extraction.detalles_cheques.map(swapChequeRow),
    total_cheques: swapField(extraction.total_cheques),
    n_c_rechazo_total: extraction.n_c_rechazo_total.map(swapNcRow),
    n_c_rechazo_parcial: extraction.n_c_rechazo_parcial.map(swapNcRow),
    n_c_por_negocios: extraction.n_c_por_negocios.map(swapNcRow),
    detalle_transferencias: extraction.detalle_transferencias.map(swapTransferenciaRow),
    detalle_credito_vendedor: extraction.detalle_credito_vendedor.map(
      swapCreditoVendedorRow
    ),
    detalle_efectivo: {
      billetes: extraction.detalle_efectivo.billetes.map(swapBilleteRow),
      monedas: extraction.detalle_efectivo.monedas.map(swapBilleteRow),
      total_billetes: swapField(extraction.detalle_efectivo.total_billetes),
      total_monedas: swapField(extraction.detalle_efectivo.total_monedas),
      total_efectivo: swapField(extraction.detalle_efectivo.total_efectivo),
    },
    total_n_c_rechazo_total: swapField(extraction.total_n_c_rechazo_total),
    total_n_c_rechazo_parcial: swapField(extraction.total_n_c_rechazo_parcial),
    total_n_c_por_negocios: swapField(extraction.total_n_c_por_negocios),
    total_transferencias: swapField(extraction.total_transferencias),
    numero_deposito_en_efectivo: swapField(
      extraction.numero_deposito_en_efectivo
    ),
    monto_deposito_en_efectivo: swapField(
      extraction.monto_deposito_en_efectivo
    ),
    observaciones: swapField(extraction.observaciones),
  };
}

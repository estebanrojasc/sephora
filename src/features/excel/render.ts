import { unzipSync, zipSync } from "fflate";
import { parseNumber } from "@/lib/parse-number";
import type { Record as AppRecord } from "@/features/records/types";
import type {
  DetalleTablaRow,
  RendicionLists,
  RendicionPayload,
  ScalarValue,
} from "./build-rendicion";
import { buildRendicionPayload, mergeRendicionPayloads } from "./build-rendicion";
import {
  TEMPLATE_RESUMEN_ROWS,
  recordLabel,
  scalarForPlaceholder,
  summaryColumnForRecord,
} from "./consolidated-resumen";

const decoder = new TextDecoder("utf-8");
const encoder = new TextEncoder();

const LIST_ROW = 37;
/** Fila ancla: cheques a fecha ({{chq_fechas}} en plantilla). */
const CHEQUES_A_FECHA_ROW = 39;
const CREDITO_ROW = 71;
/** Primera fila de datos del bloque TRANSFERENCIA (debajo de crédito). */
const TRANSF_ROW = 73;

interface ListCellLayout {
  col: string;
  list: keyof RendicionLists;
  field: string;
  type: "text" | "number";
  extraStyle: number;
  placeholder: string;
  /** Solo rellena en la fila i = 0 del bloque (p. ej. n° recorrido). */
  firstRowOnly?: boolean;
}

const LIST_LAYOUT: ListCellLayout[] = [
  { col: "M", list: "cheques_al_dia", field: "fecha", type: "text", extraStyle: 37, placeholder: "{{chq_dia_fechas}}" },
  { col: "N", list: "cheques_al_dia", field: "banco", type: "text", extraStyle: 38, placeholder: "{{chq_dia_bancos}}" },
  { col: "O", list: "cheques_al_dia", field: "valor", type: "number", extraStyle: 39, placeholder: "{{chq_dia_valores}}" },
  { col: "P", list: "rech_total", field: "fac", type: "number", extraStyle: 42, placeholder: "{{rech_tot_fac}}" },
  { col: "Q", list: "rech_total", field: "val", type: "number", extraStyle: 72, placeholder: "{{rech_tot_val}}" },
  { col: "R", list: "rech_parcial", field: "fac", type: "number", extraStyle: 44, placeholder: "{{rech_par_fac}}" },
  { col: "S", list: "rech_parcial", field: "val", type: "number", extraStyle: 77, placeholder: "{{rech_par_val}}" },
  { col: "T", list: "negocio", field: "fac", type: "number", extraStyle: 42, placeholder: "{{neg_fac}}" },
  { col: "U", list: "negocio", field: "val", type: "number", extraStyle: 72, placeholder: "{{neg_val}}" },
];

/** Bloque cheques a fecha (fila 39 en plantilla; fila 38 = total cheques al día). */
const CHEQUES_A_FECHA_LAYOUT: ListCellLayout[] = [
  { col: "M", list: "cheques_a_fecha", field: "fecha", type: "text", extraStyle: 37, placeholder: "{{chq_fechas}}" },
  { col: "N", list: "cheques_a_fecha", field: "banco", type: "text", extraStyle: 38, placeholder: "{{chq_bancos}}" },
  { col: "O", list: "cheques_a_fecha", field: "valor", type: "number", extraStyle: 39, placeholder: "{{chq_valores}}" },
];

/** Fila 71: primera fila del bloque CREDITO. Solo esa fila lleva placeholders. */
const CREDITO_LAYOUT: ListCellLayout[] = [
  { col: "M", list: "credito_vendedor", field: "cliente", type: "text", extraStyle: 63, placeholder: "{{cred_cliente}}" },
  { col: "P", list: "credito_vendedor", field: "no_fac", type: "text", extraStyle: 66, placeholder: "{{cred_fac}}" },
  { col: "T", list: "credito_vendedor", field: "valor", type: "number", extraStyle: 159, placeholder: "{{cred_valor}}" },
  { col: "V", list: "credito_vendedor", field: "nro_vendedor", type: "text", extraStyle: 55, placeholder: "{{cred_vend}}" },
];

/** Fila 73: primera fila del bloque TRANSFERENCIA. Columnas según plantilla (banco en U, no O). */
const TRANSF_LAYOUT: ListCellLayout[] = [
  { col: "L", list: "transferencias", field: "recorrido", type: "text", extraStyle: 49, placeholder: "{{transf_recorrido}}", firstRowOnly: true },
  { col: "M", list: "transferencias", field: "cliente", type: "text", extraStyle: 89, placeholder: "{{transf_cliente}}" },
  { col: "P", list: "transferencias", field: "no_fac", type: "text", extraStyle: 91, placeholder: "{{transf_fac}}" },
  { col: "T", list: "transferencias", field: "valor", type: "number", extraStyle: 69, placeholder: "{{transf_valor}}" },
  { col: "U", list: "transferencias", field: "banco", type: "text", extraStyle: 100, placeholder: "{{transf_banco}}" },
];

interface ListBlock {
  anchorRow: number;
  layout: ListCellLayout[];
  count: (lists: RendicionLists) => number;
  /**
   * Filas de datos con placeholders en plantilla desde anchorRow (incluye ancla).
   * Crédito: solo 71 (72 = separador antes de transferencias).
   * Transferencias: 73–74. Cheques a fecha: solo 39 (38 = total cheques al día).
   */
  templateDataRows?: number;
}

const LIST_BLOCKS: ListBlock[] = [
  {
    anchorRow: LIST_ROW,
    layout: LIST_LAYOUT,
    count: (l) =>
      Math.max(
        l.cheques_al_dia?.length ?? 0,
        l.rech_total?.length ?? 0,
        l.rech_parcial?.length ?? 0,
        l.negocio?.length ?? 0,
        1
      ),
    /** Solo fila 37; fila 38 = total cheques al día en plantilla. */
    templateDataRows: 1,
  },
  {
    anchorRow: CHEQUES_A_FECHA_ROW,
    layout: CHEQUES_A_FECHA_LAYOUT,
    count: (l) => Math.max(l.cheques_a_fecha?.length ?? 0, 1),
    templateDataRows: 1,
  },
  {
    anchorRow: CREDITO_ROW,
    layout: CREDITO_LAYOUT,
    count: (l) => Math.max(l.credito_vendedor?.length ?? 0, 1),
    /** Solo fila 71; la 72 es separador fijo antes de transferencias. */
    templateDataRows: 1,
  },
  {
    anchorRow: TRANSF_ROW,
    layout: TRANSF_LAYOUT,
    count: (l) => Math.max(l.transferencias?.length ?? 0, 1),
    templateDataRows: 2,
  },
];

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isEmpty(value: string | undefined | null): boolean {
  return !value || !value.trim();
}

function parsePlaceholderIndices(sharedStringsXml: string): Map<string, number> {
  const map = new Map<string, number>();
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let idx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sharedStringsXml)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, "");
    if (/^\{\{[\w.]+\}\}$/.test(text)) {
      map.set(text, idx);
    }
    idx++;
  }
  return map;
}

function forceFullRecalc(workbookXml: string): string {
  const calcPr = /<calcPr\b[^/>]*\/>|<calcPr\b[^>]*>[\s\S]*?<\/calcPr>/;
  const replacement = '<calcPr calcMode="auto" fullCalcOnLoad="1"/>';
  if (calcPr.test(workbookXml)) {
    return workbookXml.replace(calcPr, replacement);
  }
  return workbookXml.replace("</workbook>", `${replacement}</workbook>`);
}

function clearStalePlaceholderCaches(xml: string): string {
  return xml.replace(
    /(<f\b[^>]*>[\s\S]*?<\/f>)\s*<v>[^<]*\{\{[^<]*\}\}[^<]*<\/v>/g,
    "$1"
  );
}

function trimSparseTailRows(xml: string, maxRealisticRow = 1000): string {
  let lastRow = 0;
  xml = xml.replace(
    /<row\b[^>]*\br="(\d+)"[^>]*>[\s\S]*?<\/row>/g,
    (full, rowStr) => {
      const row = parseInt(rowStr, 10);
      if (row > maxRealisticRow) return "";
      if (row > lastRow) lastRow = row;
      return full;
    }
  );
  if (lastRow > 0) {
    xml = xml.replace(
      /(<dimension\s+ref=")[^"]+("\s*\/>)/,
      `$1A1:W${lastRow}$2`
    );
  }
  return xml;
}

function shiftRowsInWorksheet(
  xml: string,
  fromRow: number,
  delta: number
): string {
  if (delta <= 0) return xml;

  const shiftCellRefs = (s: string) =>
    s.replace(/([A-Z]+)(\d+)/g, (_, col, rowStr) => {
      const row = parseInt(rowStr, 10);
      return row >= fromRow ? `${col}${row + delta}` : `${col}${row}`;
    });

  xml = xml.replace(/<row\b([^>]*?)\br="(\d+)"/g, (_, attrs, rowStr) => {
    const row = parseInt(rowStr, 10);
    const newRow = row >= fromRow ? row + delta : row;
    return `<row${attrs}r="${newRow}"`;
  });

  xml = xml.replace(
    /<c\b([^>]*?)\br="([A-Z]+)(\d+)"/g,
    (_, attrs, col, rowStr) => {
      const row = parseInt(rowStr, 10);
      const newRow = row >= fromRow ? row + delta : row;
      return `<c${attrs}r="${col}${newRow}"`;
    }
  );

  xml = xml.replace(
    /(\bref=")([^"]+)(")/g,
    (_, p1, val, p3) => p1 + shiftCellRefs(val) + p3
  );

  xml = xml.replace(
    /(<f\b[^>]*>)([\s\S]*?)(<\/f>)/g,
    (_, open, body, close) => open + shiftCellRefs(body) + close
  );

  return xml;
}

function replaceCellsByStringIndex(
  xml: string,
  idx: number,
  scalar: ScalarValue
): string {
  const cellRe = /<c\b([^>]*?)>\s*<v>(\d+)<\/v>\s*<\/c>/g;
  return xml.replace(cellRe, (full, attrs, vIdx) => {
    if (parseInt(vIdx, 10) !== idx) return full;
    if (!/\bt="s"/.test(attrs)) return full;
    return buildCellFromAttrs(attrs, scalar);
  });
}

function buildCellFromAttrs(originalAttrs: string, scalar: ScalarValue): string {
  const cleaned = originalAttrs.replace(/\s+t="s"/g, "");
  if (isEmpty(scalar.value)) {
    return `<c${cleaned}/>`;
  }
  if (scalar.numeric) {
    const n = parseNumber(scalar.value);
    if (n === null) {
      return `<c${cleaned} t="inlineStr"><is><t xml:space="preserve">${escapeXmlText(
        scalar.value
      )}</t></is></c>`;
    }
    return `<c${cleaned}><v>${n}</v></c>`;
  }
  return `<c${cleaned} t="inlineStr"><is><t xml:space="preserve">${escapeXmlText(
    scalar.value
  )}</t></is></c>`;
}

function buildCellXml(
  ref: string,
  style: number,
  value: string | undefined,
  type: "text" | "number"
): string {
  if (isEmpty(value)) {
    return `<c r="${ref}" s="${style}"/>`;
  }
  if (type === "number") {
    const n = parseNumber(value!);
    if (n === null) {
      return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXmlText(value!)}</t></is></c>`;
    }
    return `<c r="${ref}" s="${style}"><v>${n}</v></c>`;
  }
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXmlText(value!)}</t></is></c>`;
}

function listValueAt(
  lists: RendicionLists,
  layout: ListCellLayout,
  i: number
): string | undefined {
  const rows = lists[layout.list] as
    | Array<DetalleTablaRow | { [key: string]: string }>
    | undefined;
  if (!Array.isArray(rows)) return undefined;
  const item = rows[i] as { [key: string]: string } | undefined;
  if (!item) return undefined;
  if (layout.firstRowOnly && i > 0) return undefined;
  return item[layout.field];
}

function buildExtraListRowXml(
  rowNum: number,
  layout: ListCellLayout[],
  lists: RendicionLists,
  i: number
): string {
  const cells = layout.map((cell) =>
    buildCellXml(
      `${cell.col}${rowNum}`,
      cell.extraStyle,
      listValueAt(lists, cell, i),
      cell.type
    )
  );
  return `<row r="${rowNum}" spans="1:23" x14ac:dyDescent="0.3">${cells.join("")}</row>`;
}

function worksheetHasRow(xml: string, rowNum: number): boolean {
  return new RegExp(`<row\\b[^>]*\\br="${rowNum}"`).test(xml);
}

function fillListRowByRef(
  xml: string,
  rowNum: number,
  layout: ListCellLayout[],
  lists: RendicionLists,
  dataIndex: number
): string {
  for (const cell of layout) {
    const ref = `${cell.col}${rowNum}`;
    const scalar: ScalarValue = {
      value: listValueAt(lists, cell, dataIndex) ?? "",
      numeric: cell.type === "number",
    };
    xml = writeCellAt(xml, ref, scalar);
  }
  return xml;
}

function expandListBlock(
  xml: string,
  anchorRow: number,
  layout: ListCellLayout[],
  lists: RendicionLists,
  _indices: Map<string, number>,
  n: number,
  templateDataRows?: number
): { xml: string; insertedRows: number } {
  const count = Math.max(n, 1);
  const maxReuseRow =
    templateDataRows != null
      ? anchorRow + templateDataRows - 1
      : anchorRow + count - 1;

  xml = fillListRowByRef(xml, anchorRow, layout, lists, 0);
  if (count <= 1) return { xml, insertedRows: 0 };

  let nextDataIndex = 1;
  let lastFilledRow = anchorRow;

  for (
    let row = anchorRow + 1;
    row <= maxReuseRow && nextDataIndex < count;
    row++
  ) {
    if (!worksheetHasRow(xml, row)) break;
    xml = fillListRowByRef(xml, row, layout, lists, nextDataIndex);
    lastFilledRow = row;
    nextDataIndex++;
  }

  const remaining = count - nextDataIndex;
  if (remaining <= 0) return { xml, insertedRows: 0 };

  const insertAt = lastFilledRow + 1;
  xml = shiftRowsInWorksheet(xml, insertAt, remaining);

  const extra: string[] = [];
  for (let j = 0; j < remaining; j++) {
    extra.push(
      buildExtraListRowXml(insertAt + j, layout, lists, nextDataIndex + j)
    );
  }

  const anchorRe = new RegExp(
    `(<row\\b[^>]*\\br="${lastFilledRow}"[^>]*>[\\s\\S]*?</row>)`
  );
  return {
    xml: xml.replace(anchorRe, `$1${extra.join("")}`),
    insertedRows: remaining,
  };
}

function processWorksheet(
  xml: string,
  payload: RendicionPayload,
  indices: Map<string, number>,
  options?: { expandLists?: boolean; skipScalarPlaceholders?: Set<string> }
): string {
  xml = trimSparseTailRows(xml);

  for (const [placeholder, scalar] of Object.entries(payload.scalars)) {
    if (options?.skipScalarPlaceholders?.has(placeholder)) continue;
    const idx = indices.get(placeholder);
    if (idx === undefined) continue;
    xml = replaceCellsByStringIndex(xml, idx, scalar);
  }

  if (options?.expandLists !== false) {
    let rowShift = 0;
    for (const block of LIST_BLOCKS) {
      const anchorRow = block.anchorRow + rowShift;
      const n = block.count(payload.lists);
      const { xml: nextXml, insertedRows } = expandListBlock(
        xml,
        anchorRow,
        block.layout,
        payload.lists,
        indices,
        n,
        block.templateDataRows
      );
      xml = nextXml;
      rowShift += insertedRows;
    }
  }

  return clearStalePlaceholderCaches(xml);
}

function cellStyleFromAttrs(attrs: string): number {
  const m = attrs.match(/\bs="(\d+)"/);
  return m ? parseInt(m[1], 10) : 0;
}

function writeCellAt(xml: string, ref: string, scalar: ScalarValue): string {
  const type = scalar.numeric ? ("number" as const) : ("text" as const);
  const escapedRef = ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cellRe = new RegExp(
    `<c r="${escapedRef}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`
  );
  const match = xml.match(cellRe);
  const style = match ? cellStyleFromAttrs(match[1]) : 0;
  const built = buildCellXml(ref, style, scalar.value, type);
  if (match) {
    return xml.replace(cellRe, built);
  }
  const rowMatch = ref.match(/(\d+)$/);
  if (!rowMatch) return xml;
  const rowNum = rowMatch[1]!;
  const rowRe = new RegExp(
    `(<row\\b[^>]*\\br="${rowNum}"[^>]*>)([\\s\\S]*?)(</row>)`
  );
  return xml.replace(rowRe, `$1${built}$2$3`);
}

/** Resumen superior (filas 1–21): un registro por columna B, C, D… */
function fillUpperSummarySection(
  xml: string,
  records: AppRecord[],
  payloads: RendicionPayload[]
): string {
  for (let i = 0; i < records.length; i++) {
    const payload = payloads[i]!;
    const col = summaryColumnForRecord(i);

    // Etiqueta del registro en fila 8 (vacía en plantilla), sin pisar sector (fila 4).
    xml = writeCellAt(xml, `${col}8`, {
      value: recordLabel(records[i]!),
      numeric: false,
    });

    for (const field of TEMPLATE_RESUMEN_ROWS) {
      const scalar = scalarForPlaceholder(payload.scalars, field.placeholder);
      xml = writeCellAt(
        xml,
        `${col}${field.row}`,
        scalar ?? { value: "", numeric: field.sum ?? false }
      );
    }
  }

  if (records.length > 1) {
    const aggStart = 21;
    xml = writeCellAt(xml, `A${aggStart}`, {
      value: "TOTALES CONSOLIDADOS",
      numeric: false,
    });
    let aggRow = aggStart + 1;
    for (const field of TEMPLATE_RESUMEN_ROWS.filter((f) => f.sum)) {
      let sum = 0;
      let any = false;
      for (const payload of payloads) {
        const scalar = scalarForPlaceholder(payload.scalars, field.placeholder);
        if (!scalar?.value.trim()) continue;
        const n = parseNumber(scalar.value);
        if (n !== null) {
          sum += n;
          any = true;
        }
      }
      if (!any) continue;
      xml = writeCellAt(xml, `B${aggRow}`, {
        value: String(sum),
        numeric: true,
      });
      aggRow++;
    }
  }

  return xml;
}

/**
 * Hoja Resumen híbrida:
 * - Filas 1–21: un registro por columna (B, C, D…) como antes.
 * - Fila 22+: mismo motor que el individual con listas fusionadas (todas las líneas).
 */
export function renderConsolidatedResumenWorksheet(
  template: Uint8Array,
  records: AppRecord[]
): string {
  const files = unzipSync(template);
  const sharedStringsBytes = files["xl/sharedStrings.xml"];
  if (!sharedStringsBytes) {
    throw new Error("La plantilla no contiene xl/sharedStrings.xml");
  }
  const indices = parsePlaceholderIndices(decoder.decode(sharedStringsBytes));
  const worksheetBytes = files["xl/worksheets/sheet1.xml"];
  if (!worksheetBytes) {
    throw new Error("La plantilla no contiene xl/worksheets/sheet1.xml");
  }

  const payloads = records.map((r) => buildRendicionPayload(r));
  const merged = mergeRendicionPayloads(payloads);

  let xml = trimSparseTailRows(decoder.decode(worksheetBytes));
  xml = fillUpperSummarySection(xml, records, payloads);
  // El resumen superior ya escribe celdas B+ como inline/número; no hace falta
  // saltar placeholders: solo quedan referencias shared string en la zona inferior (col Q+).
  xml = processWorksheet(xml, merged, indices);

  return clearStalePlaceholderCaches(xml);
}

export function renderRendicionWorksheet(
  template: Uint8Array,
  payload: RendicionPayload
): string {
  const files = unzipSync(template);
  const sharedStringsBytes = files["xl/sharedStrings.xml"];
  if (!sharedStringsBytes) {
    throw new Error("La plantilla no contiene xl/sharedStrings.xml");
  }
  const indices = parsePlaceholderIndices(decoder.decode(sharedStringsBytes));
  const worksheetBytes = files["xl/worksheets/sheet1.xml"];
  if (!worksheetBytes) {
    throw new Error("La plantilla no contiene xl/worksheets/sheet1.xml");
  }
  return processWorksheet(decoder.decode(worksheetBytes), payload, indices);
}

export function renderRendicionExcel(
  template: Uint8Array,
  payload: RendicionPayload
): Uint8Array {
  const files = unzipSync(template);

  const sharedStringsBytes = files["xl/sharedStrings.xml"];
  if (!sharedStringsBytes) {
    throw new Error("La plantilla no contiene xl/sharedStrings.xml");
  }
  const indices = parsePlaceholderIndices(decoder.decode(sharedStringsBytes));

  const worksheetPath = "xl/worksheets/sheet1.xml";
  const worksheetBytes = files[worksheetPath];
  if (!worksheetBytes) {
    throw new Error("La plantilla no contiene xl/worksheets/sheet1.xml");
  }
  const processed = processWorksheet(
    decoder.decode(worksheetBytes),
    payload,
    indices
  );
  files[worksheetPath] = encoder.encode(processed);

  const workbookPath = "xl/workbook.xml";
  const workbookBytes = files[workbookPath];
  if (workbookBytes) {
    files[workbookPath] = encoder.encode(
      forceFullRecalc(decoder.decode(workbookBytes))
    );
  }

  delete files["xl/calcChain.xml"];

  return zipSync(files, { level: 6 });
}

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
  { col: "K", list: "cheques_al_dia", field: "fecha", type: "text", extraStyle: 37, placeholder: "{{chq_dia_fechas}}" },
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
  { col: "K", list: "cheques_a_fecha", field: "fecha", type: "text", extraStyle: 37, placeholder: "{{chq_fechas}}" },
  { col: "N", list: "cheques_a_fecha", field: "banco", type: "text", extraStyle: 38, placeholder: "{{chq_bancos}}" },
  { col: "O", list: "cheques_a_fecha", field: "valor", type: "number", extraStyle: 39, placeholder: "{{chq_valores}}" },
];

/** Fila 71: primera fila del bloque CREDITO. Solo esa fila lleva placeholders. */
const CREDITO_LAYOUT: ListCellLayout[] = [
  { col: "A", list: "credito_vendedor", field: "recorrido", type: "text", extraStyle: 49, placeholder: "{{cred_recorrido}}" },
  { col: "M", list: "credito_vendedor", field: "cliente", type: "text", extraStyle: 63, placeholder: "{{cred_cliente}}" },
  { col: "P", list: "credito_vendedor", field: "no_fac", type: "text", extraStyle: 66, placeholder: "{{cred_fac}}" },
  { col: "S", list: "credito_vendedor", field: "valor", type: "number", extraStyle: 159, placeholder: "{{cred_valor}}" },
  { col: "U", list: "credito_vendedor", field: "nro_vendedor", type: "text", extraStyle: 55, placeholder: "{{cred_vend}}" },
];

/** Fila 73: primera fila del bloque TRANSFERENCIA. */
const TRANSF_LAYOUT: ListCellLayout[] = [
  { col: "L", list: "transferencias", field: "recorrido", type: "text", extraStyle: 49, placeholder: "{{transf_recorrido}}" },
  { col: "M", list: "transferencias", field: "cliente", type: "text", extraStyle: 89, placeholder: "{{transf_cliente}}" },
  { col: "P", list: "transferencias", field: "no_fac", type: "text", extraStyle: 91, placeholder: "{{transf_fac}}" },
  { col: "S", list: "transferencias", field: "valor", type: "number", extraStyle: 69, placeholder: "{{transf_valor}}" },
  { col: "U", list: "transferencias", field: "banco", type: "text", extraStyle: 100, placeholder: "{{transf_banco}}" },
];

/** Columnas con etiquetas estáticas (CREDITO, TRANSFERENCIA, F/.) — no duplicar al expandir. */
const STATIC_LABEL_COLS = new Set(["N", "Q", "R"]);

interface ListBlock {
  id: string;
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

interface ListBlockExpansionMeta {
  anchorRow: number;
  dataRowCount: number;
}

const LIST_BLOCKS: ListBlock[] = [
  {
    id: "cheques_rech",
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
    id: "cheques_a_fecha",
    anchorRow: CHEQUES_A_FECHA_ROW,
    layout: CHEQUES_A_FECHA_LAYOUT,
    count: (l) => Math.max(l.cheques_a_fecha?.length ?? 0, 1),
    templateDataRows: 1,
  },
  {
    id: "credito",
    anchorRow: CREDITO_ROW,
    layout: CREDITO_LAYOUT,
    count: (l) => Math.max(l.credito_vendedor?.length ?? 0, 1),
    /** Solo fila 71; la 72 es separador fijo antes de transferencias. */
    templateDataRows: 1,
  },
  {
    id: "transferencia",
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

function parseSharedStrings(sharedStringsXml: string): string[] {
  const strings: string[] = [];
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sharedStringsXml)) !== null) {
    strings.push(m[1].replace(/<[^>]+>/g, ""));
  }
  return strings;
}

function cellTextFromParts(
  inner: string,
  attrs: string,
  strings: string[]
): string {
  const vm = inner.match(/<v>(\d+)<\/v>/);
  if (vm && attrs.includes('t="s"')) {
    return strings[parseInt(vm[1], 10)] ?? "";
  }
  const isT = inner.match(/<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>/);
  return isT ? isT[1]! : "";
}

function normalizePlaceholder(text: string): string | null {
  const trimmed = text.trim();
  if (/^\{\{[\w._]+\}\}$/.test(trimmed)) return trimmed;
  return null;
}

/** Mapa placeholder → refs de celda (sharedStrings e inlineStr). */
export function discoverPlaceholderCells(
  sheetXml: string,
  strings: string[]
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const m of sheetXml.matchAll(
    /<c r="([A-Z]+)(\d+)"([^>/]*)(?:\/>|>([\s\S]*?)<\/c>)/g
  )) {
    const ref = `${m[1]}${m[2]}`;
    const inner = m[4] ?? "";
    const text = cellTextFromParts(inner, m[3]!, strings);
    const ph = normalizePlaceholder(text);
    if (!ph) continue;
    const refs = map.get(ph) ?? [];
    refs.push(ref);
    map.set(ph, refs);
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

/** Elimina calcChain.xml y referencias huérfanas (rompe la apertura en Excel). */
function stripCalcChainFromPackage(files: Record<string, Uint8Array>): void {
  delete files["xl/calcChain.xml"];

  const relsPath = "xl/_rels/workbook.xml.rels";
  const relsBytes = files[relsPath];
  if (relsBytes) {
    files[relsPath] = encoder.encode(
      decoder
        .decode(relsBytes)
        .replace(/<Relationship[^>]*calcChain[^>]*\/>/g, "")
    );
  }

  const ctPath = "[Content_Types].xml";
  const ctBytes = files[ctPath];
  if (ctBytes) {
    files[ctPath] = encoder.encode(
      decoder.decode(ctBytes).replace(/<Override[^>]*calcChain[^>]*\/>/g, "")
    );
  }
}

function updateSheetDimension(xml: string): string {
  let lastRow = 0;
  for (const m of xml.matchAll(/<row\b[^>]*\br="(\d+)"/g)) {
    const row = parseInt(m[1]!, 10);
    if (row > lastRow) lastRow = row;
  }
  if (lastRow > 0) {
    xml = xml.replace(
      /(<dimension\s+ref=")[^"]+("\s*\/>)/,
      `$1A1:W${lastRow}$2`
    );
  }
  return xml;
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

function fillPlaceholderOnRow(
  xml: string,
  rowNum: number,
  placeholder: string,
  scalar: ScalarValue,
  strings: string[]
): string {
  for (const m of xml.matchAll(
    /<c r="([A-Z]+)(\d+)"([^>/]*)(?:\/>|>([\s\S]*?)<\/c>)/g
  )) {
    if (parseInt(m[2]!, 10) !== rowNum) continue;
    const text = cellTextFromParts(m[4] ?? "", m[3]!, strings);
    if (normalizePlaceholder(text) !== placeholder) continue;
    xml = writeCellAt(xml, `${m[1]}${m[2]}`, scalar);
  }
  return xml;
}

function replacePlaceholderEverywhere(
  xml: string,
  placeholder: string,
  scalar: ScalarValue,
  strings: string[]
): string {
  for (const m of xml.matchAll(
    /<c r="([A-Z]+)(\d+)"([^>/]*)(?:\/>|>([\s\S]*?)<\/c>)/g
  )) {
    const text = cellTextFromParts(m[4] ?? "", m[3]!, strings);
    if (normalizePlaceholder(text) !== placeholder) continue;
    xml = writeCellAt(xml, `${m[1]}${m[2]}`, scalar);
  }
  return xml;
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
  i: number,
  columnStyles?: Map<string, number>
): string {
  const cells = layout.map((cell) =>
    buildCellXml(
      `${cell.col}${rowNum}`,
      columnStyles?.get(cell.col) ?? cell.extraStyle,
      listValueAt(lists, cell, i),
      cell.type
    )
  );
  return `<row r="${rowNum}" spans="1:23" x14ac:dyDescent="0.3">${cells.join("")}</row>`;
}

function extractRowXml(xml: string, rowNum: number): string | null {
  const re = new RegExp(`<row\\b[^>]*\\br="${rowNum}"[^>]*>[\\s\\S]*?<\\/row>`);
  return xml.match(re)?.[0] ?? null;
}

function extractColumnStyles(xml: string, rowNum: number): Map<string, number> {
  const map = new Map<string, number>();
  const rowXml = extractRowXml(xml, rowNum);
  if (!rowXml) return map;
  for (const m of rowXml.matchAll(
    /<c r="([A-Z]+)\d+"([^>/]*)(?:\/>|>([\s\S]*?)<\/c>)/g
  )) {
    map.set(m[1]!, cellStyleFromAttrs(m[2]!));
  }
  return map;
}

function cellHasSharedPlaceholder(inner: string, attrs: string): boolean {
  return attrs.includes('t="s"') && /<v>\d+<\/v>/.test(inner);
}

function cellHasPlaceholderText(
  inner: string,
  attrs: string,
  strings: string[]
): boolean {
  const text = cellTextFromParts(inner, attrs, strings);
  return normalizePlaceholder(text) !== null;
}

function blankCellPreserveStyle(ref: string, attrs: string): string {
  const cleaned = attrs.replace(/\s+t="s"/g, "");
  return `<c r="${ref}"${cleaned}/>`;
}

function resolveLayoutForAnchorRow(
  xml: string,
  anchorRow: number,
  layout: ListCellLayout[],
  strings: string[]
): ListCellLayout[] {
  const resolved: ListCellLayout[] = [];
  const seen = new Set<string>();

  for (const cell of layout) {
    const colsForPlaceholder = new Set<string>([cell.col]);
    for (const m of xml.matchAll(
      /<c r="([A-Z]+)(\d+)"([^>/]*)(?:\/>|>([\s\S]*?)<\/c>)/g
    )) {
      if (parseInt(m[2]!, 10) !== anchorRow) continue;
      const text = cellTextFromParts(m[4] ?? "", m[3]!, strings);
      if (normalizePlaceholder(text) !== cell.placeholder) continue;
      colsForPlaceholder.add(m[1]!);
    }
    for (const col of colsForPlaceholder) {
      const key = `${col}:${cell.placeholder}`;
      if (seen.has(key)) continue;
      seen.add(key);
      resolved.push({ ...cell, col });
    }
  }
  return resolved;
}

function cloneListRowFromAnchor(
  xml: string,
  anchorRow: number,
  targetRow: number,
  resolvedLayout: ListCellLayout[],
  lists: RendicionLists,
  dataIndex: number,
  strings: string[]
): string {
  const anchorXml = extractRowXml(xml, anchorRow);
  if (!anchorXml) {
    return buildExtraListRowXml(
      targetRow,
      resolvedLayout,
      lists,
      dataIndex,
      extractColumnStyles(xml, anchorRow)
    );
  }

  const layoutByCol = new Map(resolvedLayout.map((l) => [l.col, l]));
  const rowAttrs = anchorXml.match(/<row\b([^>]*)>/)?.[1] ?? "";
  const spansMatch = rowAttrs.match(/\bspans="([^"]+)"/);
  const spans = spansMatch ? ` spans="${spansMatch[1]}"` : ' spans="1:23"';

  const cells: string[] = [];
  for (const cellMatch of anchorXml.matchAll(
    /<c r="([A-Z]+)(\d+)"([^>/]*)(?:\/>|>([\s\S]*?)<\/c>)/g
  )) {
    const col = cellMatch[1]!;
    const attrs = cellMatch[3]!;
    const inner = cellMatch[4] ?? "";
    const ref = `${col}${targetRow}`;
    const layoutCell = layoutByCol.get(col);

    if (layoutCell) {
      const scalar: ScalarValue = {
        value: listValueAt(lists, layoutCell, dataIndex) ?? "",
        numeric: layoutCell.type === "number",
      };
      cells.push(buildCellFromAttrs(` r="${ref}"${attrs}`, scalar));
      continue;
    }

    if (cellMatch[0].endsWith("/>")) {
      cells.push(`<c r="${ref}"${attrs}/>`);
      continue;
    }

    if (dataIndex > 0) {
      if (
        STATIC_LABEL_COLS.has(col) ||
        cellHasPlaceholderText(inner, attrs, strings) ||
        !cellHasSharedPlaceholder(inner, attrs)
      ) {
        cells.push(blankCellPreserveStyle(ref, attrs));
        continue;
      }
    }

    if (cellHasSharedPlaceholder(inner, attrs) && dataIndex > 0) {
      cells.push(blankCellPreserveStyle(ref, attrs));
      continue;
    }

    cells.push(
      cellMatch[0]
        .replace(`${col}${anchorRow}`, ref)
        .replace(new RegExp(`<c r="${col}\\d+"`), `<c r="${ref}"`)
    );
  }

  return `<row r="${targetRow}"${spans} x14ac:dyDescent="0.3">${cells.join("")}</row>`;
}

function worksheetHasRow(xml: string, rowNum: number): boolean {
  return new RegExp(`<row\\b[^>]*\\br="${rowNum}"`).test(xml);
}

function fillListRowByRef(
  xml: string,
  rowNum: number,
  resolvedLayout: ListCellLayout[],
  lists: RendicionLists,
  dataIndex: number,
  strings: string[]
): string {
  const colsWritten = new Set<string>();
  for (const cell of resolvedLayout) {
    const scalar: ScalarValue = {
      value: listValueAt(lists, cell, dataIndex) ?? "",
      numeric: cell.type === "number",
    };
    xml = fillPlaceholderOnRow(xml, rowNum, cell.placeholder, scalar, strings);
    if (!colsWritten.has(cell.col)) {
      colsWritten.add(cell.col);
      xml = writeCellAt(xml, `${cell.col}${rowNum}`, scalar);
    }
  }
  return xml;
}

function expandListBlock(
  xml: string,
  anchorRow: number,
  layout: ListCellLayout[],
  lists: RendicionLists,
  strings: string[],
  n: number,
  templateDataRows?: number
): {
  xml: string;
  insertedRows: number;
  meta: ListBlockExpansionMeta;
  insertedRowNumbers: number[];
} {
  const count = Math.max(n, 1);
  const resolvedLayout = resolveLayoutForAnchorRow(
    xml,
    anchorRow,
    layout,
    strings
  );
  const maxReuseRow =
    templateDataRows != null
      ? anchorRow + templateDataRows - 1
      : anchorRow + count - 1;

  xml = fillListRowByRef(xml, anchorRow, resolvedLayout, lists, 0, strings);
  if (count <= 1) {
    return {
      xml,
      insertedRows: 0,
      meta: { anchorRow, dataRowCount: count },
      insertedRowNumbers: [],
    };
  }

  let nextDataIndex = 1;
  let lastFilledRow = anchorRow;

  for (
    let row = anchorRow + 1;
    row <= maxReuseRow && nextDataIndex < count;
    row++
  ) {
    if (!worksheetHasRow(xml, row)) break;
    xml = fillListRowByRef(xml, row, resolvedLayout, lists, nextDataIndex, strings);
    lastFilledRow = row;
    nextDataIndex++;
  }

  const remaining = count - nextDataIndex;
  if (remaining <= 0) {
    return {
      xml,
      insertedRows: 0,
      meta: { anchorRow, dataRowCount: count },
      insertedRowNumbers: [],
    };
  }

  const insertAt = lastFilledRow + 1;
  xml = shiftRowsInWorksheet(xml, insertAt, remaining);

  const extra: string[] = [];
  const insertedRowNumbers: number[] = [];
  for (let j = 0; j < remaining; j++) {
    const rowNum = insertAt + j;
    insertedRowNumbers.push(rowNum);
    extra.push(
      cloneListRowFromAnchor(
        xml,
        anchorRow,
        rowNum,
        resolvedLayout,
        lists,
        nextDataIndex + j,
        strings
      )
    );
  }

  const anchorRe = new RegExp(
    `(<row\\b[^>]*\\br="${lastFilledRow}"[^>]*>[\\s\\S]*?</row>)`
  );
  return {
    xml: xml.replace(anchorRe, `$1${extra.join("")}`),
    insertedRows: remaining,
    meta: { anchorRow, dataRowCount: count },
    insertedRowNumbers,
  };
}

function processWorksheet(
  xml: string,
  payload: RendicionPayload,
  strings: string[],
  options?: { expandLists?: boolean; skipScalarPlaceholders?: Set<string> }
): string {
  xml = trimSparseTailRows(xml);

  if (options?.expandLists !== false) {
    let rowShift = 0;
    for (const block of LIST_BLOCKS) {
      const anchorRow = block.anchorRow + rowShift;
      const n = block.count(payload.lists);
      const { xml: nextXml, insertedRows, meta } = expandListBlock(
        xml,
        anchorRow,
        block.layout,
        payload.lists,
        strings,
        n,
        block.templateDataRows
      );
      xml = nextXml;
      rowShift += insertedRows;
    }
  }

  for (const [placeholder, scalar] of Object.entries(payload.scalars)) {
    if (options?.skipScalarPlaceholders?.has(placeholder)) continue;
    xml = replacePlaceholderEverywhere(xml, placeholder, scalar, strings);
  }

  return updateSheetDimension(clearStalePlaceholderCaches(xml));
}

function cellStyleFromAttrs(attrs: string): number {
  const m = attrs.match(/\bs="(\d+)"/);
  return m ? parseInt(m[1], 10) : 0;
}

function writeCellAt(xml: string, ref: string, scalar: ScalarValue): string {
  const escapedRef = ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cellRe = new RegExp(
    `<c r="${escapedRef}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`
  );
  const match = xml.match(cellRe);
  const built = match
    ? buildCellFromAttrs(` r="${ref}"${match[1]!}`, scalar)
    : buildCellFromAttrs(` r="${ref}"`, scalar);
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

/** Resumen superior (filas 1–17): un registro por columna B, C, D… */
function fillUpperSummarySection(
  xml: string,
  records: AppRecord[],
  payloads: RendicionPayload[]
): string {
  for (let i = 0; i < records.length; i++) {
    const payload = payloads[i]!;
    const col = summaryColumnForRecord(i);

    for (const field of TEMPLATE_RESUMEN_ROWS) {
      const scalar = scalarForPlaceholder(payload.scalars, field.placeholder);
      xml = writeCellAt(
        xml,
        `${col}${field.row}`,
        scalar ?? { value: "", numeric: field.sum ?? false }
      );
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
  const sharedStringsXml = decoder.decode(sharedStringsBytes);
  const strings = parseSharedStrings(sharedStringsXml);
  const worksheetBytes = files["xl/worksheets/sheet1.xml"];
  if (!worksheetBytes) {
    throw new Error("La plantilla no contiene xl/worksheets/sheet1.xml");
  }

  const payloads = records.map((r) => buildRendicionPayload(r));
  const merged = mergeRendicionPayloads(payloads);

  let xml = trimSparseTailRows(decoder.decode(worksheetBytes));
  xml = fillUpperSummarySection(xml, records, payloads);
  xml = processWorksheet(xml, merged, strings);

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
  const sharedStringsXml = decoder.decode(sharedStringsBytes);
  const strings = parseSharedStrings(sharedStringsXml);
  const worksheetBytes = files["xl/worksheets/sheet1.xml"];
  if (!worksheetBytes) {
    throw new Error("La plantilla no contiene xl/worksheets/sheet1.xml");
  }
  const sheetXml = decoder.decode(worksheetBytes);
  return processWorksheet(sheetXml, payload, strings);
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
  const sharedStringsXml = decoder.decode(sharedStringsBytes);
  const strings = parseSharedStrings(sharedStringsXml);

  const worksheetPath = "xl/worksheets/sheet1.xml";
  const worksheetBytes = files[worksheetPath];
  if (!worksheetBytes) {
    throw new Error("La plantilla no contiene xl/worksheets/sheet1.xml");
  }
  const sheetXml = decoder.decode(worksheetBytes);
  const processed = processWorksheet(sheetXml, payload, strings);
  files[worksheetPath] = encoder.encode(processed);

  const workbookPath = "xl/workbook.xml";
  const workbookBytes = files[workbookPath];
  if (workbookBytes) {
    files[workbookPath] = encoder.encode(
      forceFullRecalc(decoder.decode(workbookBytes))
    );
  }

  stripCalcChainFromPackage(files);

  return zipSync(files, { level: 6 });
}

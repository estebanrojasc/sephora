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
  { col: "L", list: "credito_vendedor", field: "recorrido", type: "text", extraStyle: 49, placeholder: "{{cred_recorrido}}" },
  { col: "M", list: "credito_vendedor", field: "cliente", type: "text", extraStyle: 63, placeholder: "{{cred_cliente}}" },
  { col: "P", list: "credito_vendedor", field: "no_fac", type: "text", extraStyle: 66, placeholder: "{{cred_fac}}" },
  { col: "T", list: "credito_vendedor", field: "valor", type: "number", extraStyle: 159, placeholder: "{{cred_valor}}" },
  { col: "V", list: "credito_vendedor", field: "nro_vendedor", type: "text", extraStyle: 55, placeholder: "{{cred_vend}}" },
];

/** Fila 73: primera fila del bloque TRANSFERENCIA. Columnas según plantilla (banco en U, no O). */
const TRANSF_LAYOUT: ListCellLayout[] = [
  { col: "L", list: "transferencias", field: "recorrido", type: "text", extraStyle: 49, placeholder: "{{transf_recorrido}}" },
  { col: "M", list: "transferencias", field: "cliente", type: "text", extraStyle: 89, placeholder: "{{transf_cliente}}" },
  { col: "P", list: "transferencias", field: "no_fac", type: "text", extraStyle: 91, placeholder: "{{transf_fac}}" },
  { col: "T", list: "transferencias", field: "valor", type: "number", extraStyle: 69, placeholder: "{{transf_valor}}" },
  { col: "U", list: "transferencias", field: "banco", type: "text", extraStyle: 100, placeholder: "{{transf_banco}}" },
];

interface ListBlock {
  id: string;
  anchorRow: number;
  layout: ListCellLayout[];
  count: (lists: RendicionLists) => number;
  /** Duplica merge horizontal R:S al insertar filas (etiqueta CREDITO / TRANSFERENCIA). */
  duplicateLabelMerge?: boolean;
  /** Texto de la etiqueta en columnas R:S (p. ej. CREDITO, TRANSFERENCIA). */
  rowLabel?: string;
  /**
   * Filas de datos con placeholders en plantilla desde anchorRow (incluye ancla).
   * Crédito: solo 71 (72 = separador antes de transferencias).
   * Transferencias: 73–74. Cheques a fecha: solo 39 (38 = total cheques al día).
   */
  templateDataRows?: number;
  /** Fila de referencia para bordes/altura al clonar (sin thickBot de cabecera). */
  cloneStyleRow?: number;
}

interface ListBlockExpansionMeta {
  blockId: string;
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
    cloneStyleRow: 40,
  },
  {
    id: "cheques_a_fecha",
    anchorRow: CHEQUES_A_FECHA_ROW,
    layout: CHEQUES_A_FECHA_LAYOUT,
    count: (l) => Math.max(l.cheques_a_fecha?.length ?? 0, 1),
    templateDataRows: 1,
    cloneStyleRow: 40,
  },
  {
    id: "credito",
    anchorRow: CREDITO_ROW,
    layout: CREDITO_LAYOUT,
    count: (l) => Math.max(l.credito_vendedor?.length ?? 0, 1),
    /** Solo fila 71; la 72 es separador fijo antes de transferencias. */
    templateDataRows: 1,
    duplicateLabelMerge: true,
    rowLabel: "CREDITO",
    cloneStyleRow: 72,
  },
  {
    id: "transferencia",
    anchorRow: TRANSF_ROW,
    layout: TRANSF_LAYOUT,
    count: (l) => Math.max(l.transferencias?.length ?? 0, 1),
    templateDataRows: 2,
    duplicateLabelMerge: true,
    rowLabel: "TRANSFERENCIA",
    cloneStyleRow: 75,
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

function parsePlaceholderIndices(sharedStringsXml: string): Map<string, number> {
  const map = new Map<string, number>();
  const strings = parseSharedStrings(sharedStringsXml);
  for (let idx = 0; idx < strings.length; idx++) {
    const text = strings[idx]!;
    if (/^\{\{[\w.]+\}\}$/.test(text)) {
      map.set(text, idx);
    }
  }
  return map;
}

function cellDisplayText(
  attrs: string,
  inner: string,
  strings: string[]
): string {
  if (!inner) return "";
  const vm = inner.match(/<v>(\d+)<\/v>/);
  if (vm && /\bt="s"/.test(attrs)) {
    return strings[parseInt(vm[1], 10)] ?? "";
  }
  const isT = inner.match(/<is>[\s\S]*?<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/);
  if (isT) return isT[1] ?? "";
  const vn = inner.match(/<v>([^<]+)<\/v>/);
  return vn ? vn[1]! : "";
}

/** Reemplaza un placeholder en todas las celdas (sharedStrings e inlineStr). */
function replacePlaceholderEverywhere(
  xml: string,
  placeholder: string,
  scalar: ScalarValue,
  strings: string[]
): string {
  const cellRe = /<c r="([A-Z]+)(\d+)"([^>/]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
  return xml.replace(cellRe, (full, col, row, attrs, inner = "") => {
    if (/<f\b/.test(inner)) return full;
    const text = cellDisplayText(attrs, inner, strings).trim();
    if (text !== placeholder) return full;
    return buildCellFromAttrs(` r="${col}${row}"${attrs}`, scalar);
  });
}

export function discoverPlaceholderCells(
  sheetXml: string,
  strings: string[]
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const m of sheetXml.matchAll(
    /<c r="([A-Z]+)(\d+)"([^>/]*)(?:\/>|>([\s\S]*?)<\/c>)/g
  )) {
    const ref = `${m[1]}${m[2]}`;
    const text = cellDisplayText(m[3]!, m[4] ?? "", strings).trim();
    if (!/^\{\{[\w.]+\}\}$/.test(text)) continue;
    const arr = map.get(text) ?? [];
    arr.push(ref);
    map.set(text, arr);
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

export function stripCalcChainFromPackage(files: Record<string, Uint8Array>): void {
  delete files["xl/calcChain.xml"];

  const relsPath = "xl/_rels/workbook.xml.rels";
  if (files[relsPath]) {
    let relsXml = decoder.decode(files[relsPath]);
    relsXml = relsXml.replace(/<Relationship[^>]*calcChain[^>]*\/>/g, "");
    files[relsPath] = encoder.encode(relsXml);
  }

  const ctPath = "[Content_Types].xml";
  if (files[ctPath]) {
    let ctXml = decoder.decode(files[ctPath]);
    ctXml = ctXml.replace(/<Override[^>]*calcChain[^>]*\/>/g, "");
    files[ctPath] = encoder.encode(ctXml);
  }
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

function isPlaceholderText(text: string): boolean {
  return /^\{\{[\w.]+\}\}$/.test(text.trim());
}

function insertRowsAfter(xml: string, afterRow: number, rows: string[]): string {
  const re = new RegExp(
    `<row\\b[^>]*\\br="${afterRow}"[^>]*>[\\s\\S]*?</row>`
  );
  const m = re.exec(xml);
  if (!m || m.index === undefined) return xml;
  const pos = m.index + m[0].length;
  return xml.slice(0, pos) + rows.join("") + xml.slice(pos);
}

function normalizeRowAttrs(attrs: string): string {
  return attrs
    .replace(/\bthickBot="1"/g, "")
    .replace(/\bthickTop="1"/g, "")
    .replace(/\bht="[^"]*"/g, "")
    .replace(/\bcustomHeight="1"/g, "");
}

function shiftCellRefInFragment(fragment: string, anchorRow: number, targetRow: number): string {
  const delta = targetRow - anchorRow;
  if (delta === 0) return fragment;
  return fragment.replace(/([A-Z]+)(\d+)/g, (_, col, rowStr) => {
    const row = parseInt(rowStr, 10);
    if (row === anchorRow) return `${col}${targetRow}`;
    return `${col}${row}`;
  });
}

function cloneListRowFromAnchor(
  xml: string,
  anchorRow: number,
  targetRow: number,
  layout: ListCellLayout[],
  lists: RendicionLists,
  dataIndex: number,
  strings: string[],
  cloneStyleRow?: number
): string {
  const anchorXml = extractRowXml(xml, anchorRow);
  if (!anchorXml) {
    return buildExtraListRowXml(
      targetRow,
      layout,
      lists,
      dataIndex,
      extractColumnStyles(xml, cloneStyleRow ?? anchorRow)
    );
  }

  const styleRowXml = extractRowXml(xml, cloneStyleRow ?? anchorRow);
  const layoutByCol = new Map(layout.map((l) => [l.col, l]));
  const rowAttrsRaw =
    styleRowXml?.match(/<row\b([^>]*)>/)?.[1] ??
    anchorXml.match(/<row\b([^>]*)>/)?.[1] ??
    "";
  const spansMatch = rowAttrsRaw.match(/\bspans="([^"]+)"/);
  const spans = spansMatch ? ` spans="${spansMatch[1]}"` : ' spans="1:23"';
  const rowAttrs = normalizeRowAttrs(
    rowAttrsRaw.replace(/\s*r="\d+"/g, "").replace(/\bspans="[^"]+"/g, "")
  );

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
      cells.push(
        buildCellXml(
          ref,
          layoutCell.extraStyle,
          listValueAt(lists, layoutCell, dataIndex),
          layoutCell.type
        )
      );
      continue;
    }

    if (cellMatch[0].endsWith("/>")) {
      cells.push(`<c r="${ref}"${attrs}/>`);
      continue;
    }

    const text = cellDisplayText(attrs, inner, strings).trim();
    if (dataIndex > 0 && isPlaceholderText(text)) {
      cells.push(`<c r="${ref}"${attrs.replace(/\s+t="s"/g, "")}/>`);
      continue;
    }

    cells.push(
      shiftCellRefInFragment(
        cellMatch[0]
          .replace(`${col}${anchorRow}`, ref)
          .replace(new RegExp(`<c r="${col}\\d+"`), `<c r="${ref}"`),
        anchorRow,
        targetRow
      )
    );
  }

  return `<row r="${targetRow}"${rowAttrs}${spans} x14ac:dyDescent="0.3">${cells.join("")}</row>`;
}

function appendMergeCells(xml: string, refs: string[]): string {
  if (refs.length === 0) return xml;
  const tags = refs.map((r) => `<mergeCell ref="${r}"/>`).join("");
  const mcRe =
    /<mergeCells\b[^>]*\bcount="(\d+)"[^>]*>([\s\S]*?)<\/mergeCells>/;
  const m = xml.match(mcRe);
  if (m) {
    const newCount = parseInt(m[1]!, 10) + refs.length;
    return xml.replace(
      mcRe,
      `<mergeCells count="${newCount}">${m[2]}${tags}</mergeCells>`
    );
  }
  return xml.replace(
    "</worksheet>",
    `<mergeCells count="${refs.length}">${tags}</mergeCells></worksheet>`
  );
}

function worksheetHasRow(xml: string, rowNum: number): boolean {
  return new RegExp(`<row\\b[^>]*\\br="${rowNum}"`).test(xml);
}

function fillListRowByRef(
  xml: string,
  rowNum: number,
  layout: ListCellLayout[],
  lists: RendicionLists,
  dataIndex: number,
  rowLabel?: string
): string {
  for (const cell of layout) {
    const ref = `${cell.col}${rowNum}`;
    const scalar: ScalarValue = {
      value: listValueAt(lists, cell, dataIndex) ?? "",
      numeric: cell.type === "number",
    };
    xml = writeCellAt(xml, ref, scalar, cell.extraStyle);
  }
  if (rowLabel) {
    xml = writeCellAt(
      xml,
      `R${rowNum}`,
      { value: rowLabel, numeric: false },
      177
    );
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
  templateDataRows?: number,
  duplicateLabelMerge?: boolean,
  cloneStyleRow?: number,
  rowLabel?: string
): {
  xml: string;
  insertedRows: number;
  meta: ListBlockExpansionMeta;
  insertedRowNumbers: number[];
} {
  const count = Math.max(n, 1);
  const maxReuseRow =
    templateDataRows != null
      ? anchorRow + templateDataRows - 1
      : anchorRow + count - 1;

  xml = fillListRowByRef(xml, anchorRow, layout, lists, 0, rowLabel);
  if (count <= 1) {
    return {
      xml,
      insertedRows: 0,
      meta: { blockId: "", anchorRow, dataRowCount: count },
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
    xml = fillListRowByRef(xml, row, layout, lists, nextDataIndex, rowLabel);
    lastFilledRow = row;
    nextDataIndex++;
  }

  const remaining = count - nextDataIndex;
  if (remaining <= 0) {
    return {
      xml,
      insertedRows: 0,
      meta: { blockId: "", anchorRow, dataRowCount: count },
      insertedRowNumbers: [],
    };
  }

  const insertAt = lastFilledRow + 1;
  xml = shiftRowsInWorksheet(xml, insertAt, remaining);

  const cloneAnchorRow =
    templateDataRows != null && templateDataRows > 0
      ? anchorRow + templateDataRows - 1
      : anchorRow;

  const extra: string[] = [];
  const insertedRowNumbers: number[] = [];
  for (let j = 0; j < remaining; j++) {
    const rowNum = insertAt + j;
    insertedRowNumbers.push(rowNum);
    extra.push(
      cloneListRowFromAnchor(
        xml,
        cloneAnchorRow,
        rowNum,
        layout,
        lists,
        nextDataIndex + j,
        strings,
        cloneStyleRow
      )
    );
  }

  if (duplicateLabelMerge) {
    xml = appendMergeCells(
      xml,
      insertedRowNumbers.map((row) => `R${row}:S${row}`)
    );
  }

  return {
    xml: insertRowsAfter(xml, lastFilledRow, extra),
    insertedRows: remaining,
    meta: { blockId: "", anchorRow, dataRowCount: count },
    insertedRowNumbers,
  };
}

function scrubUnfilledListPlaceholders(
  xml: string,
  strings: string[],
  layouts: ListCellLayout[]
): string {
  let out = xml;
  for (const cell of layouts) {
    out = replacePlaceholderEverywhere(
      out,
      cell.placeholder,
      { value: "", numeric: cell.type === "number" },
      strings
    );
  }
  return out;
}

const ALL_LIST_LAYOUTS: ListCellLayout[] = [
  ...LIST_LAYOUT,
  ...CHEQUES_A_FECHA_LAYOUT,
  ...CREDITO_LAYOUT,
  ...TRANSF_LAYOUT,
];

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
      const { xml: nextXml, insertedRows } = expandListBlock(
        xml,
        anchorRow,
        block.layout,
        payload.lists,
        strings,
        n,
        block.templateDataRows,
        block.duplicateLabelMerge,
        block.cloneStyleRow,
        block.rowLabel
      );
      xml = nextXml;
      rowShift += insertedRows;
    }
  }

  for (const [placeholder, scalar] of Object.entries(payload.scalars)) {
    if (options?.skipScalarPlaceholders?.has(placeholder)) continue;
    xml = replacePlaceholderEverywhere(xml, placeholder, scalar, strings);
  }

  xml = scrubUnfilledListPlaceholders(xml, strings, ALL_LIST_LAYOUTS);

  return clearStalePlaceholderCaches(xml);
}

function cellStyleFromAttrs(attrs: string): number {
  const m = attrs.match(/\bs="(\d+)"/);
  return m ? parseInt(m[1], 10) : 0;
}

function writeCellAt(
  xml: string,
  ref: string,
  scalar: ScalarValue,
  fallbackStyle?: number
): string {
  const type = scalar.numeric ? ("number" as const) : ("text" as const);
  const escapedRef = ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const cellRe = new RegExp(
    `<c r="${escapedRef}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`
  );
  const match = xml.match(cellRe);
  const style = match ? cellStyleFromAttrs(match[1]) : (fallbackStyle ?? 0);
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
  return processWorksheet(decoder.decode(worksheetBytes), payload, strings);
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
  const processed = processWorksheet(
    decoder.decode(worksheetBytes),
    payload,
    strings
  );
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

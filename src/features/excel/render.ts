import { unzipSync, zipSync } from "fflate";
import { parseNumber } from "@/lib/parse-number";
import type {
  DetalleTablaRow,
  RendicionLists,
  RendicionPayload,
  ScalarValue,
} from "./build-rendicion";
import {
  LIST_BLOCK_GROUPS,
  LIST_PLACEHOLDER_REGISTRY,
  type ListBlockGroup,
} from "./placeholder-registry";
import {
  parseTemplatePlaceholderIndices,
  scanWorksheetPlaceholders,
} from "./template-scan";

const decoder = new TextDecoder("utf-8");
const encoder = new TextEncoder();

interface ResolvedListCell {
  placeholder: string;
  col: string;
  row: number;
  extraStyle: number;
  list: keyof RendicionLists;
  field: string;
  type: "text" | "number";
  firstRowOnly?: boolean;
}

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isEmpty(value: string | undefined | null): boolean {
  return !value || !value.trim();
}

function blockCanExpand(
  resolved: ResolvedListCell[],
  group: ListBlockGroup
): boolean {
  const dataPlaceholders = group.placeholders.filter(
    (ph) => !LIST_PLACEHOLDER_REGISTRY[ph]?.firstRowOnly
  );
  const dataCells = resolved.filter((r) =>
    dataPlaceholders.includes(r.placeholder)
  );
  if (dataCells.length !== dataPlaceholders.length) return false;
  const rows = new Set(dataCells.map((r) => r.row));
  return rows.size === 1;
}

function blockAnchorRow(resolved: ResolvedListCell[]): number {
  const dataCells = resolved.filter((r) => !r.firstRowOnly);
  const rows = dataCells.length > 0 ? dataCells : resolved;
  return Math.min(...rows.map((r) => r.row));
}

function effectiveBlockCount(
  resolved: ResolvedListCell[],
  group: ListBlockGroup,
  rawCount: number
): number {
  if (!blockCanExpand(resolved, group)) return 1;
  return rawCount;
}

function discoverBlockStates(
  xml: string,
  indices: Map<string, number>,
  lists: RendicionLists
): Array<{
  anchorRow: number;
  resolved: ResolvedListCell[];
  group: ListBlockGroup;
  n: number;
}> {
  const cells = scanWorksheetPlaceholders(xml, indices);
  const byPlaceholder = new Map(cells.map((c) => [c.placeholder, c]));
  const states: Array<{
    anchorRow: number;
    resolved: ResolvedListCell[];
    group: ListBlockGroup;
    n: number;
  }> = [];

  for (const group of LIST_BLOCK_GROUPS) {
    const resolved: ResolvedListCell[] = [];
    for (const ph of group.placeholders) {
      const def = LIST_PLACEHOLDER_REGISTRY[ph];
      const cell = byPlaceholder.get(ph);
      if (!def || !cell) continue;
      resolved.push({
        placeholder: ph,
        col: cell.col,
        row: cell.row,
        extraStyle: cell.style,
        list: def.list,
        field: def.field,
        type: def.type,
        firstRowOnly: def.firstRowOnly,
      });
    }
    if (resolved.length === 0) continue;
    const n = effectiveBlockCount(resolved, group, group.count(lists));
    states.push({
      anchorRow: blockAnchorRow(resolved),
      resolved,
      group,
      n,
    });
  }

  return states.sort((a, b) => a.anchorRow - b.anchorRow);
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

function replaceInlinePlaceholder(
  xml: string,
  placeholder: string,
  scalar: ScalarValue
): string {
  const esc = placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `(<c r="([A-Z]+)(\\d+)"([^>]*) t="inlineStr"[^>]*><is><t(?: xml:space="preserve")?> )${esc}(</t></is></c>)`,
    "g"
  );
  return xml.replace(re, (_, _open, col, row, attrs) =>
    buildCellFromAttrs(` r="${col}${row}"${attrs}`, scalar)
  );
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
  cell: ResolvedListCell,
  i: number
): string | undefined {
  const rows = lists[cell.list] as
    | Array<DetalleTablaRow | { [key: string]: string }>
    | undefined;
  if (!Array.isArray(rows)) return undefined;
  const item = rows[i] as { [key: string]: string } | undefined;
  if (!item) return undefined;
  if (cell.firstRowOnly && i > 0) return undefined;
  return item[cell.field];
}

function buildExtraListRowXml(
  rowNum: number,
  resolved: ResolvedListCell[],
  lists: RendicionLists,
  i: number
): string {
  const cells = resolved
    .filter((cell) => !cell.firstRowOnly)
    .map((cell) =>
      buildCellXml(
        `${cell.col}${rowNum}`,
        cell.extraStyle,
        listValueAt(lists, cell, i),
        cell.type
      )
    );
  return `<row r="${rowNum}" spans="1:23" x14ac:dyDescent="0.3">${cells.join("")}</row>`;
}

function expandListBlock(
  xml: string,
  anchorRow: number,
  resolved: ResolvedListCell[],
  lists: RendicionLists,
  indices: Map<string, number>,
  n: number
): string {
  for (const cell of resolved) {
    const idx = indices.get(cell.placeholder);
    if (idx === undefined) continue;
    const scalar: ScalarValue = {
      value: listValueAt(lists, cell, 0) ?? "",
      numeric: cell.type === "number",
    };
    xml = replaceCellsByStringIndex(xml, idx, scalar);
  }

  if (n <= 1) return xml;

  const delta = n - 1;
  xml = shiftRowsInWorksheet(xml, anchorRow + 1, delta);

  const extra: string[] = [];
  for (let i = 1; i < n; i++) {
    extra.push(buildExtraListRowXml(anchorRow + i, resolved, lists, i));
  }

  const anchorRe = new RegExp(
    `(<row\\b[^>]*\\br="${anchorRow}"[^>]*>[\\s\\S]*?</row>)`
  );
  return xml.replace(anchorRe, `$1${extra.join("")}`);
}

function processWorksheet(
  xml: string,
  payload: RendicionPayload,
  indices: Map<string, number>
): string {
  xml = trimSparseTailRows(xml);

  for (const [placeholder, scalar] of Object.entries(payload.scalars)) {
    const idx = indices.get(placeholder);
    if (idx !== undefined) {
      xml = replaceCellsByStringIndex(xml, idx, scalar);
    }
    xml = replaceInlinePlaceholder(xml, placeholder, scalar);
  }

  const blockStates = discoverBlockStates(xml, indices, payload.lists);
  let rowShift = 0;

  for (const state of blockStates) {
    const anchorRow = state.anchorRow + rowShift;
    xml = expandListBlock(
      xml,
      anchorRow,
      state.resolved,
      payload.lists,
      indices,
      state.n
    );
    if (state.n > 1) rowShift += state.n - 1;
  }

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
  const indices = parseTemplatePlaceholderIndices(
    decoder.decode(sharedStringsBytes)
  );
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
  const indices = parseTemplatePlaceholderIndices(
    decoder.decode(sharedStringsBytes)
  );

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

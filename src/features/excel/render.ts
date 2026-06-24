import { unzipSync, zipSync } from "fflate";
import { parseNumber } from "@/lib/parse-number";
import type {
  DetalleTablaRow,
  RendicionLists,
  RendicionPayload,
  ScalarValue,
} from "./build-rendicion";

const decoder = new TextDecoder("utf-8");
const encoder = new TextEncoder();

const LIST_ROW = 37;
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
  { col: "M", list: "cheques", field: "fecha", type: "text", extraStyle: 37, placeholder: "{{chq_fechas}}" },
  { col: "N", list: "cheques", field: "banco", type: "text", extraStyle: 38, placeholder: "{{chq_bancos}}" },
  { col: "O", list: "cheques", field: "valor", type: "number", extraStyle: 39, placeholder: "{{chq_valores}}" },
  { col: "P", list: "rech_total", field: "fac", type: "number", extraStyle: 42, placeholder: "{{rech_tot_fac}}" },
  { col: "Q", list: "rech_total", field: "val", type: "number", extraStyle: 72, placeholder: "{{rech_tot_val}}" },
  { col: "R", list: "rech_parcial", field: "fac", type: "number", extraStyle: 44, placeholder: "{{rech_par_fac}}" },
  { col: "S", list: "rech_parcial", field: "val", type: "number", extraStyle: 77, placeholder: "{{rech_par_val}}" },
  { col: "T", list: "negocio", field: "fac", type: "number", extraStyle: 42, placeholder: "{{neg_fac}}" },
  { col: "U", list: "negocio", field: "val", type: "number", extraStyle: 72, placeholder: "{{neg_val}}" },
];

/** Fila 71: primera fila del bloque CREDITO. Solo esa fila lleva placeholders. */
const CREDITO_LAYOUT: ListCellLayout[] = [
  { col: "M", list: "credito_vendedor", field: "cliente", type: "text", extraStyle: 89, placeholder: "{{cred_cliente}}" },
  { col: "P", list: "credito_vendedor", field: "no_fac", type: "text", extraStyle: 91, placeholder: "{{cred_fac}}" },
  { col: "T", list: "credito_vendedor", field: "valor", type: "number", extraStyle: 69, placeholder: "{{cred_valor}}" },
  { col: "V", list: "credito_vendedor", field: "nro_vendedor", type: "text", extraStyle: 55, placeholder: "{{cred_vend}}" },
];

/** Fila 73: primera fila del bloque TRANSFERENCIA. Solo esa fila lleva placeholders. */
const TRANSF_LAYOUT: ListCellLayout[] = [
  { col: "L", list: "transferencias", field: "recorrido", type: "text", extraStyle: 49, placeholder: "{{transf_recorrido}}", firstRowOnly: true },
  { col: "M", list: "transferencias", field: "cliente", type: "text", extraStyle: 89, placeholder: "{{transf_cliente}}" },
  { col: "P", list: "transferencias", field: "no_fac", type: "text", extraStyle: 91, placeholder: "{{transf_fac}}" },
  { col: "T", list: "transferencias", field: "valor", type: "number", extraStyle: 69, placeholder: "{{transf_valor}}" },
];

interface ListBlock {
  anchorRow: number;
  layout: ListCellLayout[];
  count: (lists: RendicionLists) => number;
}

const LIST_BLOCKS: ListBlock[] = [
  { anchorRow: LIST_ROW, layout: LIST_LAYOUT, count: (l) => Math.max(l.cheques.length, l.rech_total.length, l.rech_parcial.length, l.negocio.length, 1) },
  { anchorRow: CREDITO_ROW, layout: CREDITO_LAYOUT, count: (l) => Math.max(l.credito_vendedor.length, 1) },
  { anchorRow: TRANSF_ROW, layout: TRANSF_LAYOUT, count: (l) => Math.max(l.transferencias.length, 1) },
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
  const rows = lists[layout.list] as DetalleTablaRow[] | { [key: string]: string }[];
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

function expandListBlock(
  xml: string,
  anchorRow: number,
  layout: ListCellLayout[],
  lists: RendicionLists,
  indices: Map<string, number>,
  n: number
): string {
  for (const cell of layout) {
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
    extra.push(buildExtraListRowXml(anchorRow + i, layout, lists, i));
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
    if (idx === undefined) continue;
    xml = replaceCellsByStringIndex(xml, idx, scalar);
  }

  let rowShift = 0;
  for (const block of LIST_BLOCKS) {
    const anchorRow = block.anchorRow + rowShift;
    const n = block.count(payload.lists);
    xml = expandListBlock(
      xml,
      anchorRow,
      block.layout,
      payload.lists,
      indices,
      n
    );
    if (n > 1) rowShift += n - 1;
  }

  return clearStalePlaceholderCaches(xml);
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

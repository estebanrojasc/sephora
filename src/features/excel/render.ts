import { unzipSync, zipSync } from "fflate";
import { parseNumber } from "@/lib/parse-number";
import type {
  RendicionLists,
  RendicionPayload,
  ScalarValue,
} from "./build-rendicion";

const decoder = new TextDecoder("utf-8");
const encoder = new TextEncoder();

/** Fila base que contiene los placeholders de listas en la plantilla. */
const LIST_ROW = 37;

interface ListCellLayout {
  col: string;
  list: keyof RendicionLists;
  field: "fecha" | "banco" | "valor" | "fac" | "val";
  type: "text" | "number";
  /** Estilo a usar en las filas adicionales clonadas (i >= 1). */
  extraStyle: number;
  placeholder: string;
}

/**
 * Mapeo de cada placeholder de lista a su columna física en la plantilla.
 *
 * Los estilos `extraStyle` corresponden a los que la plantilla ya usa en las
 * filas 39+ (vacías formateadas), así las filas nuevas mantienen el mismo
 * borde y formato moneda que esperaríamos ver en el resto de la tabla.
 */
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

function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function isEmpty(value: string | undefined | null): boolean {
  return !value || !value.trim();
}

/**
 * Recorre `xl/sharedStrings.xml` y devuelve el índice de cada placeholder.
 * Asume que cada placeholder es un `<si>` con un único `<t>`.
 */
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
  // Sólo `fullCalcOnLoad`: Excel recalcula una vez al abrir y luego sigue en
  // modo automático normal. `forceFullCalc` obliga a recálculo completo en
  // cada cambio y, con plantillas grandes o fórmulas en `#VALUE!`, deja a
  // Excel "rendering" indefinidamente.
  const calcPr = /<calcPr\b[^/>]*\/>|<calcPr\b[^>]*>[\s\S]*?<\/calcPr>/;
  const replacement = '<calcPr calcMode="auto" fullCalcOnLoad="1"/>';
  if (calcPr.test(workbookXml)) {
    return workbookXml.replace(calcPr, replacement);
  }
  return workbookXml.replace("</workbook>", `${replacement}</workbook>`);
}

/**
 * Limpia los `<v>` cacheados de celdas con fórmula que aún contengan un
 * placeholder `{{...}}`. Sin esto, Excel mostraría el texto literal del
 * placeholder hasta que el usuario fuerce el recálculo manualmente.
 */
function clearStalePlaceholderCaches(xml: string): string {
  return xml.replace(
    /(<f\b[^>]*>[\s\S]*?<\/f>)\s*<v>[^<]*\{\{[^<]*\}\}[^<]*<\/v>/g,
    "$1"
  );
}

/**
 * La plantilla deja un par de filas en posiciones cercanas al límite de
 * Excel (1048525/1048529) que inflan `dimension` a ~1M filas y enlentecen
 * el render. Las quitamos y recalculamos `<dimension>` al rango realmente
 * usado.
 */
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

/**
 * Desplaza todas las referencias a fila >= `fromRow` en `delta` filas hacia
 * abajo. Cubre atributos `r="A1"` y `r="N"`, fórmulas `<f>...</f>` y rangos
 * `ref="A1:B2"` (mergeCells, dimension, etc.).
 */
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

  // <row r="N"
  xml = xml.replace(/<row\b([^>]*?)\br="(\d+)"/g, (_, attrs, rowStr) => {
    const row = parseInt(rowStr, 10);
    const newRow = row >= fromRow ? row + delta : row;
    return `<row${attrs}r="${newRow}"`;
  });

  // <c r="A1"
  xml = xml.replace(
    /<c\b([^>]*?)\br="([A-Z]+)(\d+)"/g,
    (_, attrs, col, rowStr) => {
      const row = parseInt(rowStr, 10);
      const newRow = row >= fromRow ? row + delta : row;
      return `<c${attrs}r="${col}${newRow}"`;
    }
  );

  // Cualquier ref="X1:Y2" (mergeCell, dimension, autoFilter, etc.).
  xml = xml.replace(
    /(\bref=")([^"]+)(")/g,
    (_, p1, val, p3) => p1 + shiftCellRefs(val) + p3
  );

  // Fórmulas: las referencias a celdas dentro de `<f>...</f>` se ajustan
  // igual que las celdas que apuntan.
  xml = xml.replace(
    /(<f\b[^>]*>)([\s\S]*?)(<\/f>)/g,
    (_, open, body, close) => open + shiftCellRefs(body) + close
  );

  return xml;
}

/**
 * Reemplaza TODAS las celdas del XML que apunten al sharedString `idx`
 * (vía `t="s"` y `<v>idx</v>`) por una nueva celda con `value` en su tipo
 * correcto.
 *
 * Se mantienen los atributos originales (incluyendo el estilo `s="..."`),
 * solo se reemplaza el tipo y el contenido.
 */
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
  // Sacamos el atributo t="s"; el resto (r="...", s="...") lo mantenemos.
  const cleaned = originalAttrs.replace(/\s+t="s"/g, "");
  if (isEmpty(scalar.value)) {
    return `<c${cleaned}/>`;
  }
  if (scalar.numeric) {
    const n = parseNumber(scalar.value);
    if (n === null) {
      // Si el modelo escribió texto no numérico en un campo monetario,
      // preferimos no romper: caemos a inline string.
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

/**
 * Construye una `<row>` que solo contiene las columnas M-U con los datos
 * de la posición `i` de cada lista. Se usa para las filas que se insertan
 * debajo de la fila 37 (i >= 1) cuando una lista tiene más de 1 elemento.
 *
 * Si una lista en particular no tiene un elemento en la posición `i`, su
 * celda queda vacía pero con el estilo correcto para mantener bordes.
 */
function listValueAt(
  lists: RendicionLists,
  layout: ListCellLayout,
  i: number
): string | undefined {
  const item = lists[layout.list][i] as
    | { [K in ListCellLayout["field"]]?: string }
    | undefined;
  return item?.[layout.field];
}

function buildExtraListRowXml(
  rowNum: number,
  lists: RendicionLists,
  i: number
): string {
  const cells = LIST_LAYOUT.map((layout) =>
    buildCellXml(
      `${layout.col}${rowNum}`,
      layout.extraStyle,
      listValueAt(lists, layout, i),
      layout.type
    )
  );
  return `<row r="${rowNum}" spans="1:23" x14ac:dyDescent="0.3">${cells.join("")}</row>`;
}

function processWorksheet(
  xml: string,
  payload: RendicionPayload,
  indices: Map<string, number>
): string {
  // 0) Quitamos filas residuales cerca del fin de la hoja para que Excel no
  //    tenga que renderizar ~1M filas vacías.
  xml = trimSparseTailRows(xml);

  // 1) Escalares: reemplazo cada celda que apunte a un placeholder por su
  //    valor real (número o texto inline) preservando el estilo original.
  for (const [placeholder, scalar] of Object.entries(payload.scalars)) {
    const idx = indices.get(placeholder);
    if (idx === undefined) continue;
    xml = replaceCellsByStringIndex(xml, idx, scalar);
  }

  // 2) Listas: en la fila 37 se llenan las celdas con el primer elemento
  //    (i = 0) de cada lista. Si la lista está vacía, la celda queda vacía.
  for (const layout of LIST_LAYOUT) {
    const idx = indices.get(layout.placeholder);
    if (idx === undefined) continue;
    const value = listValueAt(payload.lists, layout, 0);
    const scalar: ScalarValue = {
      value: value ?? "",
      numeric: layout.type === "number",
    };
    xml = replaceCellsByStringIndex(xml, idx, scalar);
  }

  // 3) Calculamos cuántas filas necesitamos como máximo (una por elemento
  //    de la lista más larga). Si N <= 1 no insertamos nada.
  const N = Math.max(
    payload.lists.cheques.length,
    payload.lists.rech_total.length,
    payload.lists.rech_parcial.length,
    payload.lists.negocio.length,
    1
  );

  if (N > 1) {
    const delta = N - 1;
    // Primero desplazamos todo lo que está debajo de la fila 37 para
    // dejarle espacio a las filas adicionales.
    xml = shiftRowsInWorksheet(xml, LIST_ROW + 1, delta);

    // Construimos las filas adicionales (i = 1..N-1) y las insertamos
    // inmediatamente después de la fila 37 (ya con sus placeholders
    // reemplazados por los datos de i = 0).
    const extra: string[] = [];
    for (let i = 1; i < N; i++) {
      extra.push(buildExtraListRowXml(LIST_ROW + i, payload.lists, i));
    }
    const row37Re = new RegExp(
      `(<row\\b[^>]*\\br="${LIST_ROW}"[^>]*>[\\s\\S]*?</row>)`
    );
    xml = xml.replace(row37Re, `$1${extra.join("")}`);
  }

  // 4) Limpiamos cachés residuales `<v>{{...}}</v>` para que Excel recalcule
  //    al abrir y muestre los valores nuevos en celdas con fórmula.
  xml = clearStalePlaceholderCaches(xml);

  return xml;
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

  // calcChain.xml puede quedar inconsistente luego del shift; Excel lo
  // reconstruye automáticamente al abrir.
  delete files["xl/calcChain.xml"];

  return zipSync(files, { level: 6 });
}

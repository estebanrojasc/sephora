import {
  LIST_PLACEHOLDER_REGISTRY,
  PLACEHOLDER_PATTERN,
} from "./placeholder-registry";

export interface PlaceholderCell {
  placeholder: string;
  col: string;
  row: number;
  style: number;
  sharedIndex: number | null;
}

/** Índice sharedStrings → texto placeholder. */
export function parseTemplatePlaceholderIndices(
  sharedStringsXml: string
): Map<string, number> {
  const map = new Map<string, number>();
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let idx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sharedStringsXml)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, "");
    if (PLACEHOLDER_PATTERN.test(text)) map.set(text, idx);
    idx++;
  }
  return map;
}

/** Todos los placeholders definidos en sharedStrings de la plantilla. */
export function listTemplatePlaceholders(sharedStringsXml: string): string[] {
  const out: string[] = [];
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sharedStringsXml)) !== null) {
    const text = m[1].replace(/<[^>]+>/g, "");
    if (PLACEHOLDER_PATTERN.test(text)) out.push(text);
  }
  return out;
}

/**
 * Escanea la hoja y ubica cada placeholder (shared string o inlineStr).
 * No asume columnas ni filas fijas.
 */
export function scanWorksheetPlaceholders(
  worksheetXml: string,
  indices: Map<string, number>
): PlaceholderCell[] {
  const reverse = new Map<number, string>();
  for (const [ph, idx] of indices) reverse.set(idx, ph);

  const found: PlaceholderCell[] = [];
  const cellRe =
    /<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let m: RegExpExecArray | null;

  while ((m = cellRe.exec(worksheetXml)) !== null) {
    const col = m[1]!;
    const row = parseInt(m[2]!, 10);
    const attrs = m[3] ?? "";
    const inner = m[4] ?? "";
    const styleMatch = attrs.match(/\bs="(\d+)"/);
    const style = styleMatch ? parseInt(styleMatch[1]!, 10) : 0;

    const vm = inner.match(/<v>(\d+)<\/v>/);
    if (vm && attrs.includes('t="s"')) {
      const idx = parseInt(vm[1]!, 10);
      const ph = reverse.get(idx);
      if (ph) {
        found.push({ placeholder: ph, col, row, style, sharedIndex: idx });
      }
      continue;
    }

    const inline =
      inner.match(/<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>/)?.[1] ??
      inner.match(/<t[^>]*>([^<]*)<\/t>/)?.[1];
    if (inline && PLACEHOLDER_PATTERN.test(inline)) {
      found.push({
        placeholder: inline,
        col,
        row,
        style,
        sharedIndex: indices.get(inline) ?? null,
      });
    }
  }

  return found;
}

export function listPlaceholdersInWorksheet(
  cells: PlaceholderCell[]
): string[] {
  return [...new Set(cells.map((c) => c.placeholder))];
}

export function isListPlaceholder(placeholder: string): boolean {
  return placeholder in LIST_PLACEHOLDER_REGISTRY;
}

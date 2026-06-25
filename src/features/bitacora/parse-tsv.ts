/**
 * Parsea texto pegado desde Excel (TSV) o HTML de tabla.
 * Devuelve matriz de celdas para preview estructurado.
 */
export function parseClipboardToGrid(raw: string): string[][] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.includes("\t") || !trimmed.includes("<table")) {
    return parseTsv(trimmed);
  }

  const fromHtml = parseHtmlTable(trimmed);
  if (fromHtml.length > 0) return fromHtml;

  return parseTsv(trimmed);
}

function parseTsv(text: string): string[][] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => line.split("\t").map((cell) => cell.trim()));
}

function parseHtmlTable(html: string): string[][] {
  const rows: string[][] = [];
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const cells: string[] = [];
    const cellRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      const text = cellMatch[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .trim();
      cells.push(text);
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

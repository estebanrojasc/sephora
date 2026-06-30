import { newId } from "@/lib/id";
import { parseToIso } from "@/lib/date-utils";
import { normalizeThousandsDisplay } from "@/lib/parse-number";
import type { BitacoraRow, BitacoraRowType } from "./types";
import { normalizePatenteDisplay } from "./normalize";
import { recorridoSuffix } from "./normalize-keys";

const ENTREGA_PENDIENTE = /entrega\s*pendiente/i;
const COMPRA_PERSONAL = /compra\s*personal/i;
const REGULARIZACION = /regularizaci[oó]n/i;
const BITACORA_TITLE = /bit[aá]cora/i;

interface ColumnMap {
  territorio: number;
  anden: number;
  patente: number;
  conductor: number;
  auxiliar: number;
  observacion: number;
  sector: number;
  recorrido: number;
  primerFolio: number;
  ultimoFolio: number;
  cantFact: number;
  puntos: number;
  montoTotal: number;
}

const DEFAULT_COLUMN_MAP: ColumnMap = {
  territorio: 0,
  anden: 1,
  patente: 2,
  conductor: 4,
  auxiliar: 6,
  observacion: 8,
  sector: 9,
  recorrido: 10,
  primerFolio: 11,
  ultimoFolio: 12,
  cantFact: 13,
  puntos: 14,
  montoTotal: 15,
};

function cellAt(cells: string[], idx: number): string {
  return cells[idx]?.trim() ?? "";
}

function cleanMonto(value: string): string | undefined {
  if (!value.trim()) return undefined;
  const stripped = value.replace(/[$\s]/g, "").trim();
  if (!stripped) return undefined;
  return normalizeThousandsDisplay(stripped) || stripped;
}

function buildColumnMap(headerRow: string[]): ColumnMap {
  const map = { ...DEFAULT_COLUMN_MAP };
  let conductorAssigned = false;

  headerRow.forEach((raw, i) => {
    const c = raw.trim().toLowerCase();
    if (/territorio/.test(c)) map.territorio = i;
    else if (/and[eé]n/.test(c)) map.anden = i;
    else if (/cam[ií]on|patente/.test(c)) map.patente = i;
    else if (/ch[oó]fer/.test(c)) {
      map.conductor = i;
      conductorAssigned = true;
    } else if (/peoneta/.test(c)) map.auxiliar = i;
    else if (/^observ/.test(c)) map.observacion = i;
    else if (/sector/.test(c)) map.sector = i;
    else if (/recorrido/.test(c)) map.recorrido = i;
    else if (/primer.*folio|^1er.*folio/.test(c)) map.primerFolio = i;
    else if (/[uú]ltimo.*folio/.test(c)) map.ultimoFolio = i;
    else if (/^fact/.test(c)) map.cantFact = i;
    else if (/^ptos/.test(c)) map.puntos = i;
    else if (/monto|total/.test(c) && i >= map.cantFact) map.montoTotal = i;
    else if (/asist/.test(c) && !conductorAssigned) {
      map.conductor = i;
    }
  });

  return map;
}

function findHeaderRowIndex(grid: string[][]): number {
  for (let i = 0; i < Math.min(grid.length, 12); i++) {
    const joined = grid[i]!.join(" ");
    if (/territorio/i.test(joined) && /recorrido/i.test(joined)) return i;
  }
  return -1;
}

function detectRowType(cells: string[], map: ColumnMap): BitacoraRowType {
  const joined = cells.join(" ").toUpperCase();
  if (BITACORA_TITLE.test(joined) && cells.filter((c) => c.trim()).length <= 2)
    return "header";
  if (/^fecha\s*:/i.test(cells[0] ?? "") || /^fecha\s*:/i.test(joined))
    return "header";
  if (ENTREGA_PENDIENTE.test(joined)) return "entrega_pendiente";
  if (COMPRA_PERSONAL.test(joined)) return "manual";
  if (REGULARIZACION.test(joined)) return "manual";

  const territorio = cellAt(cells, map.territorio);
  const patente = cellAt(cells, map.patente);
  const conductor = cellAt(cells, map.conductor);
  const recorrido = cellAt(cells, map.recorrido);

  if (!territorio && !recorrido && !patente && !conductor) {
    const fact = cellAt(cells, map.cantFact).replace(/\D/g, "");
    const monto = cellAt(cells, map.montoTotal);
    if (fact && Number.parseInt(fact, 10) > 30) return "totals";
    if (monto.includes("$") && cells.filter((c) => c.trim()).length <= 4)
      return "totals";
  }

  if (
    patente === "-" &&
    (COMPRA_PERSONAL.test(conductor) || REGULARIZACION.test(conductor))
  ) {
    return "manual";
  }
  if (conductor.toUpperCase() === "COMPRA PERSONAL" || COMPRA_PERSONAL.test(conductor))
    return "manual";

  if (cells.every((c) => !c.trim())) return "unknown";
  if (territorio || recorrido || patente || conductor) return "ruta";
  return "unknown";
}

function manualSubtypeFromCells(cells: string[]): string | undefined {
  const joined = cells.join(" ").toUpperCase();
  if (COMPRA_PERSONAL.test(joined)) return "compra_personal";
  if (REGULARIZACION.test(joined)) return "regularizacion";
  return undefined;
}

function findScheduledDate(cells: string[]): string | undefined {
  for (const cell of cells) {
    const iso = parseToIso(cell.trim());
    if (iso) return iso;
  }
  return undefined;
}

function extractTitle(grid: string[][]): string | undefined {
  for (const row of grid.slice(0, 4)) {
    const joined = row.join(" ").trim();
    if (BITACORA_TITLE.test(joined)) return joined;
  }
  return undefined;
}

function extractDateFromGrid(grid: string[][]): string | undefined {
  for (const row of grid.slice(0, 6)) {
    for (let i = 0; i < row.length; i++) {
      if (/^fecha\s*:?$/i.test(row[i]?.trim() ?? "")) {
        for (let j = i + 1; j < row.length; j++) {
          const iso = parseToIso(row[j]?.trim());
          if (iso) return iso;
        }
      }
    }
    const joined = row.join(" ");
    const inline = joined.match(
      /fecha\s*:?\s*(?:\w+\s+)?(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i
    );
    if (inline) {
      const iso = parseToIso(inline[1]);
      if (iso) return iso;
    }
  }
  for (const row of grid.slice(0, 4)) {
    const m = row.join(" ").match(/(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/);
    if (m && BITACORA_TITLE.test(row.join(" "))) {
      const iso = parseToIso(m[1]);
      if (iso) return iso;
    }
  }
  return undefined;
}

function rowFromCells(
  cells: string[],
  map: ColumnMap,
  rowType: BitacoraRowType
): BitacoraRow {
  const rawPatente = cellAt(cells, map.patente);
  const recorrido = cellAt(cells, map.recorrido) || undefined;
  const rawMonto = cellAt(cells, map.montoTotal);

  const row: BitacoraRow = {
    id: newId(),
    rowType,
    manualSubtype:
      rowType === "manual" ? manualSubtypeFromCells(cells) : undefined,
    territorio: cellAt(cells, map.territorio) || undefined,
    anden: cellAt(cells, map.anden) || undefined,
    patente:
      rawPatente && rawPatente !== "-"
        ? normalizePatenteDisplay(rawPatente)
        : undefined,
    conductor: cellAt(cells, map.conductor) || undefined,
    auxiliar: cellAt(cells, map.auxiliar) || undefined,
    observacion: cellAt(cells, map.observacion) || undefined,
    sector: cellAt(cells, map.sector) || undefined,
    recorrido,
    recorridoSuffix: recorrido ? recorridoSuffix(recorrido) : undefined,
    primerFolio: cellAt(cells, map.primerFolio) || undefined,
    ultimoFolio: cellAt(cells, map.ultimoFolio) || undefined,
    cantFact: cellAt(cells, map.cantFact) || undefined,
    puntos: cellAt(cells, map.puntos) || undefined,
    montoTotal: cleanMonto(rawMonto),
  };

  if (rowType === "entrega_pendiente") {
    row.scheduledDate = findScheduledDate(cells);
  }

  return row;
}

/** Convierte grid TSV en filas estructuradas (parseo local, sin IA). */
export function gridToHeuristicRows(grid: string[][]): {
  rows: BitacoraRow[];
  title?: string;
  date?: string;
  warnings: string[];
} {
  const warnings: string[] = [];
  const title = extractTitle(grid);
  const date = extractDateFromGrid(grid);
  const rows: BitacoraRow[] = [];

  const headerIdx = findHeaderRowIndex(grid);
  const columnMap =
    headerIdx >= 0 ? buildColumnMap(grid[headerIdx]!) : DEFAULT_COLUMN_MAP;

  if (headerIdx < 0) {
    warnings.push(
      "No se encontró fila de encabezados; se usó el layout de columnas por defecto."
    );
  }

  const dataStart = headerIdx >= 0 ? headerIdx + 1 : 0;

  for (let i = dataStart; i < grid.length; i++) {
    const cells = grid[i]!;
    const rowType = detectRowType(cells, columnMap);
    if (rowType === "header" || rowType === "unknown") continue;
    if (rowType === "totals") {
      rows.push(rowFromCells(cells, columnMap, rowType));
      continue;
    }
    rows.push(rowFromCells(cells, columnMap, rowType));
  }

  if (!date) {
    warnings.push("No se detectó la fecha en el encabezado; revísala antes de guardar.");
  }

  const dataRows = rows.filter((r) => r.rowType !== "totals");
  if (dataRows.length === 0) {
    warnings.push("No se detectaron filas de datos. Verifica el pegado desde Excel.");
  }

  const pendientesSinFecha = rows.filter(
    (r) => r.rowType === "entrega_pendiente" && !r.scheduledDate
  );
  if (pendientesSinFecha.length > 0) {
    warnings.push(
      `${pendientesSinFecha.length} entrega(s) pendiente(s) sin fecha programada — complétala en revisión.`
    );
  }

  return { rows, title, date, warnings };
}

export function summarizeBitacoraRows(rows: BitacoraRow[]) {
  return {
    rutas: rows.filter((r) => r.rowType === "ruta").length,
    pendientes: rows.filter((r) => r.rowType === "entrega_pendiente").length,
    manuales: rows.filter((r) => r.rowType === "manual").length,
    desconocidas: rows.filter((r) => r.rowType === "unknown").length,
    totales: rows.filter((r) => r.rowType === "totals").length,
    total: rows.filter((r) => r.rowType !== "totals").length,
  };
}

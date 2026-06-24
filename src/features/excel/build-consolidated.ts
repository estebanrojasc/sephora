import { unzipSync, zipSync } from "fflate";
import { parseNumber } from "@/lib/parse-number";
import {
  ensureExtractionShape,
  type Extraction,
  type Record as AppRecord,
} from "@/features/records/types";
import { buildRendicionPayload } from "./build-rendicion";
import { renderRendicionWorksheet } from "./render";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

interface SummaryField {
  label: string;
  pick: (e: Extraction) => string;
  numeric?: boolean;
  sum?: boolean;
}

/** Campos del resumen horizontal, alineados con la columna B de la plantilla RUTA. */
const SUMMARY_FIELDS: SummaryField[] = [
  { label: "CHOFER", pick: (e) => e.conductor.valor },
  { label: "PEONETA / AUXILIAR", pick: (e) => e.auxiliar.valor },
  { label: "RECORRIDO", pick: (e) => e.n_recorrido.valor },
  { label: "N° FACT.", pick: (e) => e.cant_fact.valor, numeric: true, sum: true },
  { label: "TOTAL FACT.", pick: (e) => e.valor_total.valor, numeric: true, sum: true },
  { label: "EFECTIVO", pick: (e) => e.rendicion.efectivo_total.valor, numeric: true, sum: true },
  { label: "BILLETES", pick: (e) => e.detalle_efectivo.total_billetes.valor, numeric: true, sum: true },
  { label: "MONEDAS", pick: (e) => e.detalle_efectivo.total_monedas.valor, numeric: true, sum: true },
  { label: "CHEQUES AL DÍA", pick: (e) => e.rendicion.cheques_al_dia.valor, numeric: true, sum: true },
  { label: "CHEQUES A FECHA", pick: (e) => e.rendicion.cheques_a_fecha.valor, numeric: true, sum: true },
  { label: "CRÉDITO VENDEDOR", pick: (e) => e.rendicion.credito_vendedor.valor, numeric: true, sum: true },
  { label: "NULOS (RETORNO TOTAL)", pick: (e) => e.rendicion.retorno_total.valor, numeric: true, sum: true },
  { label: "PARCIALES (RETORNO PARCIAL)", pick: (e) => e.rendicion.retorno_parcial.valor, numeric: true, sum: true },
  { label: "N/C NEGOCIO", pick: (e) => e.rendicion.n_c_negocio.valor, numeric: true, sum: true },
  { label: "TRANSFERENCIAS", pick: (e) => e.rendicion.transferencia.valor, numeric: true, sum: true },
  { label: "TOTAL RENDICIÓN", pick: (e) => e.rendicion.total.valor, numeric: true, sum: true },
  { label: "FECHA", pick: (e) => e.fecha.valor },
  { label: "PATENTE", pick: (e) => e.patente.valor },
];

function excelCol(index: number): string {
  let n = index;
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function cellXml(ref: string, value: string, numeric?: boolean): string {
  if (!value.trim()) return `<c r="${ref}"/>`;
  if (numeric) {
    const n = parseNumber(value);
    if (n !== null) return `<c r="${ref}"><v>${n}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function buildSummaryWorksheet(records: AppRecord[]): string {
  const extractions = records.map((r) =>
    ensureExtractionShape(r.extraction!)
  );
  const rows: string[] = [];

  for (let fi = 0; fi < SUMMARY_FIELDS.length; fi++) {
    const field = SUMMARY_FIELDS[fi]!;
    const rowNum = fi + 1;
    const cells = [
      `<c r="A${rowNum}" t="inlineStr"><is><t>${escapeXml(field.label)}</t></is></c>`,
    ];
    for (let ri = 0; ri < extractions.length; ri++) {
      const col = excelCol(ri + 1);
      cells.push(
        cellXml(`${col}${rowNum}`, field.pick(extractions[ri]!), field.numeric)
      );
    }
    rows.push(`<row r="${rowNum}">${cells.join("")}</row>`);
  }

  const aggStart = 22;
  rows.push(
    `<row r="${aggStart}"><c r="A${aggStart}" t="inlineStr"><is><t>TOTALES CONSOLIDADOS</t></is></c></row>`
  );

  let aggRow = aggStart + 1;
  for (const field of SUMMARY_FIELDS.filter((f) => f.sum)) {
    let sum = 0;
    for (const e of extractions) {
      const n = parseNumber(field.pick(e));
      if (n !== null) sum += n;
    }
    rows.push(
      `<row r="${aggRow}"><c r="A${aggRow}" t="inlineStr"><is><t>${escapeXml(field.label)}</t></is></c><c r="B${aggRow}"><v>${sum}</v></c></row>`
    );
    aggRow++;
  }

  const maxRow = aggRow - 1;
  const maxCol = excelCol(Math.max(extractions.length, 1));

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${maxCol}${maxRow}"/>
<sheetViews><sheetView workbookViewId="0"/></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<sheetData>${rows.join("")}</sheetData>
</worksheet>`;
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, "").slice(0, 31) || "Ruta";
}

function sheetNameForRecord(record: AppRecord, used: Set<string>): string {
  const rec = record.extraction?.n_recorrido?.valor?.trim();
  let base = rec ? `RUTA ${rec}` : `Rec ${record.id.slice(0, 8)}`;
  base = sanitizeSheetName(base);
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    const suffix = ` (${n})`;
    candidate = sanitizeSheetName(base.slice(0, 31 - suffix.length) + suffix);
    n++;
  }
  used.add(candidate);
  return candidate;
}

export function buildConsolidatedWorkbook(
  template: Uint8Array,
  records: AppRecord[]
): Uint8Array {
  if (records.length === 0) {
    throw new Error("Se requiere al menos un registro");
  }

  const baseFiles = unzipSync(template);
  const files: Record<string, Uint8Array> = { ...baseFiles };

  files["xl/worksheets/sheet1.xml"] = encoder.encode(
    buildSummaryWorksheet(records)
  );
  delete files["xl/worksheets/_rels/sheet1.xml.rels"];

  const sheetRelsTemplate = baseFiles["xl/worksheets/_rels/sheet1.xml.rels"];
  const usedNames = new Set<string>(["Resumen"]);
  const sheetEntries: { name: string; path: string; rId: string }[] = [
    { name: "Resumen", path: "worksheets/sheet1.xml", rId: "rId1" },
  ];

  let nextRId = 6;

  for (let i = 0; i < records.length; i++) {
    const record = records[i]!;
    const sheetNum = i + 2;
    const sheetPath = `xl/worksheets/sheet${sheetNum}.xml`;
    const payload = buildRendicionPayload(record);
    files[sheetPath] = encoder.encode(
      renderRendicionWorksheet(template, payload)
    );

    if (sheetRelsTemplate) {
      files[`xl/worksheets/_rels/sheet${sheetNum}.xml.rels`] = sheetRelsTemplate;
    }

    const rId = `rId${nextRId++}`;
    sheetEntries.push({
      name: sheetNameForRecord(record, usedNames),
      path: `worksheets/sheet${sheetNum}.xml`,
      rId,
    });
  }

  let workbookXml = decoder.decode(baseFiles["xl/workbook.xml"]!);
  const sheetsXml = sheetEntries
    .map(
      (s, idx) =>
        `<sheet name="${escapeXml(s.name)}" sheetId="${idx + 1}" r:id="${s.rId}"/>`
    )
    .join("");
  workbookXml = workbookXml.replace(
    /<sheets>[\s\S]*?<\/sheets>/,
    `<sheets>${sheetsXml}</sheets>`
  );
  workbookXml = workbookXml.replace(
    /<calcPr\b[^/>]*\/>|<calcPr\b[^>]*>[\s\S]*?<\/calcPr>/,
    '<calcPr calcMode="auto" fullCalcOnLoad="1"/>'
  );
  files["xl/workbook.xml"] = encoder.encode(workbookXml);

  let relsXml = decoder.decode(baseFiles["xl/_rels/workbook.xml.rels"]!);
  relsXml = relsXml.replace(/<Relationship[^>]*calcChain[^>]*\/>/g, "");
  for (const entry of sheetEntries.slice(1)) {
    relsXml = relsXml.replace(
      "</Relationships>",
      `<Relationship Id="${entry.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${entry.path}"/></Relationships>`
    );
  }
  files["xl/_rels/workbook.xml.rels"] = encoder.encode(relsXml);

  let ctXml = decoder.decode(baseFiles["[Content_Types].xml"]!);
  ctXml = ctXml.replace(/<Override[^>]*calcChain[^>]*\/>/g, "");
  for (let i = 2; i <= records.length + 1; i++) {
    const part = `/xl/worksheets/sheet${i}.xml`;
    if (!ctXml.includes(part)) {
      ctXml = ctXml.replace(
        "</Types>",
        `<Override PartName="${part}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`
      );
    }
  }
  delete files["xl/calcChain.xml"];
  files["[Content_Types].xml"] = encoder.encode(ctXml);

  return zipSync(files, { level: 6 });
}

export function buildConsolidatedFilename(recordCount: number): string {
  const [y, m, d] = new Date()
    .toLocaleDateString("en-CA", { timeZone: "America/Santiago" })
    .split("-");
  return `${d}${m}${y?.slice(-2)}_consolidado_${recordCount}reg.xlsx`;
}

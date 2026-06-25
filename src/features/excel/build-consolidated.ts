import { unzipSync, zipSync } from "fflate";
import type { Record as AppRecord } from "@/features/records/types";
import { parseNumber } from "@/lib/parse-number";
import { buildRendicionPayload } from "./build-rendicion";
import {
  SUMMARY_FIELDS,
  extractionForRecord,
  recordLabel,
  summaryColumnForRecord,
} from "./consolidated-resumen";
import { renderRendicionWorksheet } from "./render";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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

/**
 * Hoja Resumen dedicada: etiquetas en A, un registro por columna (B, C, D…),
 * totales consolidados al final. No reutiliza la plantilla RUTA (evita placeholders
 * sin rellenar y celdas duplicadas por índice de sharedStrings).
 */
function buildSummaryWorksheet(records: AppRecord[]): string {
  const extractions = records.map((r) => extractionForRecord(r));
  const rows: string[] = [];

  const headerCells = [
    `<c r="A1" t="inlineStr"><is><t>CAMPO</t></is></c>`,
  ];
  for (let ri = 0; ri < extractions.length; ri++) {
    headerCells.push(
      cellXml(`${summaryColumnForRecord(ri)}1`, recordLabel(records[ri]!))
    );
  }
  rows.push(`<row r="1">${headerCells.join("")}</row>`);

  for (let fi = 0; fi < SUMMARY_FIELDS.length; fi++) {
    const field = SUMMARY_FIELDS[fi]!;
    const rowNum = fi + 2;
    const cells = [
      `<c r="A${rowNum}" t="inlineStr"><is><t>${escapeXml(field.label)}</t></is></c>`,
    ];
    for (let ri = 0; ri < extractions.length; ri++) {
      const col = summaryColumnForRecord(ri);
      cells.push(
        cellXml(`${col}${rowNum}`, field.pick(extractions[ri]!), field.numeric)
      );
    }
    rows.push(`<row r="${rowNum}">${cells.join("")}</row>`);
  }

  const aggStart = SUMMARY_FIELDS.length + 4;
  let maxRow = SUMMARY_FIELDS.length + 1;

  if (extractions.length > 1) {
    rows.push(
      `<row r="${aggStart}"><c r="A${aggStart}" t="inlineStr"><is><t>TOTALES CONSOLIDADOS</t></is></c></row>`
    );

    let aggRow = aggStart + 1;
    for (const field of SUMMARY_FIELDS.filter((f) => f.sum)) {
      let sum = 0;
      let any = false;
      for (const e of extractions) {
        const n = parseNumber(field.pick(e));
        if (n !== null) {
          sum += n;
          any = true;
        }
      }
      if (!any) continue;
      rows.push(
        `<row r="${aggRow}"><c r="A${aggRow}" t="inlineStr"><is><t>${escapeXml(field.label)}</t></is></c>${cellXml(`B${aggRow}`, String(sum), true)}</row>`
      );
      aggRow++;
    }
    maxRow = aggRow - 1;
  }
  const maxCol = summaryColumnForRecord(Math.max(extractions.length - 1, 0));

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
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

/**
 * Libro consolidado: hoja 1 = Resumen (tabla horizontal + totales),
 * hojas 2+ = detalle RUTA por registro (misma plantilla que el Excel individual).
 */
export function buildConsolidatedWorkbook(
  template: Uint8Array,
  records: AppRecord[]
): Uint8Array {
  if (records.length === 0) {
    throw new Error("Se requiere al menos un registro");
  }

  const baseFiles = unzipSync(template);
  const files: Record<string, Uint8Array> = { ...baseFiles };
  const sheetRelsTemplate = baseFiles["xl/worksheets/_rels/sheet1.xml.rels"];
  const totalSheets = 1 + records.length;

  files["xl/worksheets/sheet1.xml"] = encoder.encode(
    buildSummaryWorksheet(records)
  );
  delete files["xl/worksheets/_rels/sheet1.xml.rels"];

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

    sheetEntries.push({
      name: sheetNameForRecord(record, usedNames),
      path: `worksheets/sheet${sheetNum}.xml`,
      rId: `rId${nextRId++}`,
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
  relsXml = relsXml.replace(
    /<Relationship Id="rId1"[^>]*worksheet[^>]*\/>/,
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${sheetEntries[0]!.path}"/>`
  );
  for (const entry of sheetEntries.slice(1)) {
    relsXml = relsXml.replace(
      "</Relationships>",
      `<Relationship Id="${entry.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${entry.path}"/></Relationships>`
    );
  }
  files["xl/_rels/workbook.xml.rels"] = encoder.encode(relsXml);

  let ctXml = decoder.decode(baseFiles["[Content_Types].xml"]!);
  ctXml = ctXml.replace(/<Override[^>]*calcChain[^>]*\/>/g, "");
  for (let i = 1; i <= totalSheets; i++) {
    const part = `/xl/worksheets/sheet${i}.xml`;
    if (!ctXml.includes(part)) {
      ctXml = ctXml.replace(
        "</Types>",
        `<Override PartName="${part}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`
      );
    }
  }
  for (let i = totalSheets + 1; i <= 10; i++) {
    const part = `/xl/worksheets/sheet${i}.xml`;
    ctXml = ctXml.replace(
      new RegExp(`<Override PartName="${part.replace(/\//g, "\\/")}"[^>]*\\/>`, "g"),
      ""
    );
    delete files[`xl/worksheets/sheet${i}.xml`];
    delete files[`xl/worksheets/_rels/sheet${i}.xml.rels`];
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

import { unzipSync, zipSync } from "fflate";
import type { Record as AppRecord } from "@/features/records/types";
import { parseNumber } from "@/lib/parse-number";
import { buildRendicionPayload } from "./build-rendicion";
import {
  RESUMEN_SUMMARY_FIELDS,
  recordLabel,
  resumenColumnForRecord,
  scalarForPlaceholder,
} from "./consolidated-resumen";
import { renderRendicionWorksheet, renderScalarWorksheet, writeCellAtRef } from "./render";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

/** Hoja Resumen: columna B = registro 0; C, D… = resto; totales consolidados desde fila 22. */
function buildResumenWorksheet(
  template: Uint8Array,
  records: AppRecord[]
): string {
  const firstPayload = buildRendicionPayload(records[0]!);
  let xml = renderScalarWorksheet(template, firstPayload);

  for (let i = 0; i < records.length; i++) {
    const col = resumenColumnForRecord(i);
    xml = writeCellAtRef(xml, `${col}4`, {
      value: recordLabel(records[i]!),
      numeric: false,
    });
  }

  for (let i = 1; i < records.length; i++) {
    const payload = buildRendicionPayload(records[i]!);
    const col = resumenColumnForRecord(i);
    for (const field of RESUMEN_SUMMARY_FIELDS) {
      const scalar = scalarForPlaceholder(payload.scalars, field.placeholder);
      if (!scalar) continue;
      xml = writeCellAtRef(xml, `${col}${field.row}`, scalar);
    }
  }

  if (records.length > 1) {
    const aggStart = 22;
    xml = writeCellAtRef(xml, `A${aggStart}`, {
      value: "TOTALES CONSOLIDADOS",
      numeric: false,
    });
    let r = aggStart + 1;
    for (const field of RESUMEN_SUMMARY_FIELDS.filter((f) => f.numeric)) {
      let sum = 0;
      let any = false;
      for (const rec of records) {
        const scalar = scalarForPlaceholder(
          buildRendicionPayload(rec).scalars,
          field.placeholder
        );
        if (!scalar?.value.trim()) continue;
        const n = parseNumber(scalar.value);
        if (n !== null) {
          sum += n;
          any = true;
        }
      }
      if (!any) continue;
      xml = writeCellAtRef(xml, `A${r}`, { value: field.label, numeric: false });
      xml = writeCellAtRef(xml, `B${r}`, { value: String(sum), numeric: true });
      r++;
    }
  }

  return xml;
}

/**
 * Arma un libro con hoja Resumen (totales por registro) y una hoja RUTA
 * completa por registro, usando la misma plantilla que el Excel individual.
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
    buildResumenWorksheet(template, records)
  );
  if (sheetRelsTemplate) {
    files["xl/worksheets/_rels/sheet1.xml.rels"] = sheetRelsTemplate;
  }

  const usedNames = new Set<string>(["Resumen"]);
  const sheetEntries: { name: string; path: string; rId: string }[] = [
    { name: "Resumen", path: "worksheets/sheet1.xml", rId: "rId1" },
  ];

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
      rId: `rId${5 + i}`,
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
